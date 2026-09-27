import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { float, normalLocal, positionLocal } from 'three/tsl';
import { uniform } from 'three/tsl';

export default class Shield2
{
    constructor(radius = 3.5, gapRatio = 1)
    {
        this.radius = uniform(radius);
        this.gapRatio = uniform(gapRatio);

        this.ready = this.initialize();
    }

    async initialize()
    {
        await this.setGeometry();
        this.setMaterial();
        this.setMesh();

        return this.mesh;
    }

    async setGeometry()
    {
        const gltfLoader = new GLTFLoader();
        const gltf = await gltfLoader.loadAsync('./Shield1.glb');

        let modelMesh = null;

        // Finds the first mesh inside the GLB
        gltf.scene.traverse((child) => {
        if (!modelMesh && child.isMesh) {
            modelMesh = child;
        }
        });

        if (!modelMesh) {
        throw new Error('Shield2.glb does not contain a mesh.');
        }

        // Clone it so this class owns its own editable geometry
        this.geometry = modelMesh.geometry.clone();
        return this.geometry;
    }

    setMaterial()
    {
        this.material = new THREE.MeshBasicNodeMaterial({
        
        });
        this.material.colorNode = normalLocal;

        const gapRatio = this.gapRatio.mul(0.05);
        const gap = this.radius.mul(gapRatio);

        this.material.positionNode = positionLocal
                                        .mul(this.radius)
                                        .add(normalLocal.mul(gap));
        return this.material;
    }

    setMesh()
    {
        if (!this.geometry) {
        throw new Error('Geometry has not finished loading.');
        }

        if (!this.material) {
        throw new Error('Create a material before creating the mesh.');
        }

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        return this.mesh;
    }
}