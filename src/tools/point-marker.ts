import { Button, Container, NumericInput } from 'pcui';
import { TranslateGizmo, Vec3, Plane, Ray, Mouse } from 'playcanvas';

import { Events } from '../events';
import { Scene } from '../scene';
import { Splat } from '../splat';
import { PointShape } from 'src/point-shape';
import { Element, ElementType } from '../element';

class PointMarker {
    activate: () => void;
    deactivate: () => void;

    points: { [id: string]: PointShape } = {};
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
        const clearButton = new Button({ text: 'Clear', class: 'marker-toolbar-button' });
        const undoButton  = new Button({ text: 'Undo',  class: 'marker-toolbar-button' });
        const infoButton  = new Button({ text: 'Info',  class: 'marker-toolbar-button' });
        const radius = new NumericInput({
            precision: 3,
            value: 0.03,
            placeholder: 'Radius',
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
                alert(`Will copy to clipboard:\n${info}`);
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
            for (const p of Object.values(this.points)) p.radius = radius.value;
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
                    const point = new PointShape(radius.value,position.closestID);
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
            for (const p of Object.values(this.points)) scene.add(p);
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
        this.points[point.id] = point;
        this.scene.add(point);
    }

    removeMarker (point: PointShape) {
        if (this.points[point.id]) {
            this.scene.remove(point);
            delete this.points[point.id];
        }
    }
    
    clearMarkers () {
        for (const p of Object.values(this.points)) this.scene.remove(p);
        this.points = {};
    }

    hideMarkers () {
        for (const p of Object.values(this.points)) this.scene.remove(p);
    }

    popMarker () {
        const pointIds = Object.keys(this.points);
        if (pointIds.length > 0) {
            const id = pointIds.pop();
            const p = this.points[id];
            this.scene.remove(p);
            delete this.points[id];
        }
    }
    // intersect the scene at the given screen coordinate and focus the camera on this location
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
    get lenPointMarker(){
        return Object.keys(this.points).length;
    }
    get markersInfo(){
        let info = "";
        for (const id of Object.keys(this.points)) {
            info = `${info}${id}:${this.points[id].pivot.getPosition()}\n`;
        }
        return info;
    }
}

export { PointMarker };
