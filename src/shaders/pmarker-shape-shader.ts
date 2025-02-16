const vertexShader = /* glsl */ `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    void main() {
        gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 sphereColor; // 球体的颜色

    void main() {
        gl_FragColor = vec4(sphereColor, 1.0); // 使用指定的颜色，完全不透明
    }
`;

export { vertexShader, fragmentShader };
