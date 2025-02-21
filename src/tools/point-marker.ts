import { Button, Container, NumericInput } from 'pcui';
import { TranslateGizmo, Vec3, Plane, Ray, Mouse } from 'playcanvas';

import { Events } from '../events';
import { Scene } from '../scene';
import { Splat } from '../splat';
import { PointShape } from 'src/point-shape';
import { Element, ElementType } from '../element';
import { localize } from 'src/ui/localization';

class PointMarker {
    activate: () => void;
    deactivate: () => void;

    points: PointShape[] = [];
    scene: Scene;
    
    constructor(
        events: Events, 
        scene: Scene, 
        canvasContainer: Container, 
        // parent: HTMLElement
    ) {
        this.scene = scene;
        // ui
        const markerToolbar = new Container({
            id: 'marker-toolbar',
            hidden: true
        });
        markerToolbar.dom.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
        const clearButton = new Button({ text: `${localize("tooltip.pmarker_clear")}`, class: 'marker-toolbar-button' });
        const undoButton  = new Button({ text: `${localize("tooltip.pmarker_undo")}` , class: 'marker-toolbar-button' });
        const infoButton  = new Button({ text: `${localize("tooltip.pmarker_info")}` , class: 'marker-toolbar-button' });
        const radius = new NumericInput({
            precision: 3,
            value: 0.03,
            placeholder: `${localize('tooltip.radius')}`,
            width: 90,
            min: 0.001
        });
        markerToolbar.append(clearButton);
        markerToolbar.append(undoButton);
        markerToolbar.append(infoButton);
        markerToolbar.append(radius);

        canvasContainer.append(markerToolbar);
        
        clearButton.dom.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.clearMarkers();
        });
        undoButton.dom.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.popMarker();
        });
        infoButton.dom.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            const info = this.markersInfo;
            if (info != ""){
                alert(`${(localize("tooltip.pmarker_info_hint"))}:\n${info}`);
                return navigator.clipboard.writeText(info)
                    .then(() => {
                        console.log("Text copied to clipboard:", info);
                    })
                    .catch((err) => {
                        console.error("Failed to copy text:", err);
                    });
            }else{
                alert(`No point marked.`);
            }

        });
        radius.on('change', () => {
            for (const p of this.points) p.radius = radius.value;
        });
        let isDragging = false;
        let mouseDownTime = 0;
        
        const onMouseDown = (event: MouseEvent) => {
            if (event.button === 1) {
                isDragging = false;
                mouseDownTime = Date.now();
            }
        };
        const onMouseUp = (event: MouseEvent) => {
            if (event.button === 1) {
                const dragDuration = Date.now() - mouseDownTime;
                if (dragDuration < 200 && ~isDragging) {
                    const position = this.pickPositionPoint(event.offsetX, event.offsetY);
                    const point = new PointShape(radius.value, position.closestID);
                    if (position.closestID != -1) {
                        point.pivot.setPosition(position.closestP);
                        this.addMarker(point);
                    }
                }
            }
        };
        const onMouseMove = () => {
            if (mouseDownTime !== 0) {
                isDragging = true;
            }
        };
        this.activate = () => {
            for (const p of this.points) scene.add(p);
            markerToolbar.hidden = false;
            // parent.addEventListener('auxclick', pointerclick);
            parent.addEventListener('mousedown', onMouseDown);
            parent.addEventListener('mouseup'  , onMouseUp);
            parent.addEventListener('mousemove', onMouseMove);
        };

        this.deactivate = () => {
            markerToolbar.hidden = true;
            this.hideMarkers();
            // parent.removeEventListener('auxclick', pointerclick);
            parent.addEventListener('mousedown', onMouseDown);
            parent.addEventListener('mouseup'  , onMouseUp);
            parent.addEventListener('mousemove', onMouseMove);
        };
    }
    addMarker (point: PointShape) {
        this.points.push(point); // Changed to push into list
        this.scene.add(point);
    }

    removeMarker (point: PointShape) {
        const index = this.points.findIndex(p => p.id === point.id);
        if (index !== -1) {
            this.scene.remove(point);
            this.points.splice(index, 1); // Remove from list
        }
    }
    
    clearMarkers () {
        for (const p of this.points) this.scene.remove(p);
        this.points = [];
    }

    hideMarkers () {
        for (const p of this.points) this.scene.remove(p);
    }

    popMarker () {
        if (this.points.length > 0) {
            const p = this.points.pop();
            this.scene.remove(p);
        }
    }
    // intersect the scene at the given screen coordinate
    pickPositionPoint(screenX: number, screenY: number) {
        const plane = new Plane();
        const ray = new Ray();
        const vec = new Vec3();
        const vecb = new Vec3();
        const scene = this.scene;
        const camera = scene.camera;
        const cameraPos = camera.entity.getPosition();

        const target = scene.canvas;
        const sx = screenX / target.clientWidth * scene.targetSize.width;
        const sy = screenY / target.clientHeight * scene.targetSize.height;

        console.log(``);
        console.log(`单击位置: (${screenX}, ${screenY}), sx: ${sx}, sy: ${sy}`);

        const splats = scene.getElementsByType(ElementType.splat);

        let closestD = 0;
        let closestID = -1;
        const closestP = new Vec3();
        let closestSplat = null;

        for (let i = 0; i < splats.length; ++i) {
            const splat = splats[i] as Splat;

            camera.pickPrep(splat, 'set');
            const pickId = camera.pick(sx, sy);

            if (pickId !== -1) {
                splat.calcSplatWorldPosition(pickId, vec);

                // create a plane at the world position facing perpendicular to the camera
                plane.setFromPointNormal(vec, camera.entity.forward);

                // create the pick ray in world space
                if (camera.ortho) {
                    camera.entity.camera.screenToWorld(screenX, screenY, -1.0, vec);
                    camera.entity.camera.screenToWorld(screenX, screenY, 1.0, vecb);
                    vecb.sub(vec).normalize();
                    ray.set(vec, vecb);
                } else {
                    camera.entity.camera.screenToWorld(screenX, screenY, 1.0, vec);
                    vec.sub(cameraPos).normalize();
                    ray.set(cameraPos, vec);
                }

                // find intersection
                if (plane.intersectsRay(ray, vec)) {
                    const distance = vecb.sub2(vec, ray.origin).length();
                    if (!closestSplat || distance < closestD) {
                        closestD = distance;
                        closestID = pickId;
                        closestP.copy(vec);
                        closestSplat = splat;
                    }
                }
            }
        }

        if (closestSplat) {
            console.log(`splat ID: ${closestID}`);
            console.log(`coordinates: (${closestP.x}, ${closestP.y}, ${closestP.z})`);
        }
        return {closestID, closestP, closestSplat};
    }
    
    get markersInfo(){
        let info = "";
        for (const p of this.points) {
            info = `${info}${p.id}:${p.pivot.getPosition()}\n`;
        }
        return info;
    }
}

export { PointMarker };
