import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { add, attribute, color, dot, float, hash, mix, mul, mx_noise_vec3, normalLocal, normalView, objectPosition, positionLocal, positionViewDirection, positionWorld, select, sin, texture, time, TWO_PI, uv, vec3, vec4 } from 'three/tsl';
import { uniform } from 'three/tsl';
import { Fn } from 'three/src/nodes/TSL.js';

export default class Shield2
{
    constructor(
        ShieldUv, 
        radius = 1, 
        gapRatio = 1,
        colorA = color(0xb224ff),
        colorB = color(0x758cff),
        strength = 15,
        junctionRadius = 0.15
    )
    {   
        this.uvTexture = ShieldUv;
        this.radius = uniform(radius);
        this.gapRatio = uniform(gapRatio);
        this.colorA = uniform(colorA);
        this.colorB = uniform(colorB);
        this.strength = uniform(strength);
        this.junctionRadius = uniform(junctionRadius);

        this.ready = this.initialize();
    }

    async initialize()
    {
        await this.setGeometry();
        this.setMaterial();
        this.setMesh();
        this.setJunction();

        return this.mesh;
    }

    async setGeometry()
    {
        const gltfLoader = new GLTFLoader();
        const gltf = await gltfLoader.loadAsync('./Shield3.glb');

        let modelMesh = null;

        gltf.scene.traverse((child) => {
        if (!modelMesh && child.isMesh) {
            modelMesh = child;
        }
        });

        if (!modelMesh) {
        throw new Error('Shield2.glb does not contain a mesh.');
        }

        this.geometry = modelMesh.geometry.clone();
        return this.geometry;
    }

    setMaterial()
    {
        this.material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
        });
        this.material.colorNode = Fn(() => {

            const fresnel = dot(positionViewDirection, normalView).abs().oneMinus();

            const hexagonsColor = texture(this.uvTexture, uv());

            const lineStrength = positionWorld.y
                                    .mul(5)
                                    .sub(time)
                                    .sin()
                                    .remap(-1, 1, 0 , 1)
                                    .mul(0.25)
            const lines = positionWorld.y
                            .mul(50)
                            .add(time)
                            .fract()
                            .pow(3)
                            .mul(lineStrength)
            
            const emissiveStrength= add(
                hexagonsColor,
                lines
            ).mul(2);

            const finalColor = mul(
                emissiveStrength.r.mul(this.strength),
                fresnel.pow(4),
            )

            const fColor = mix(
                this.colorB,
                this.colorA,
                finalColor
            )
            return vec4(fColor.rgb, finalColor.a);
        })();

        const gapRatio = this.gapRatio.mul(0.1);
        const gap = this.radius.mul(gapRatio);

        const randFace = attribute('_randface', 'float');

        const faceValue = select(
            randFace.lessThan( 0.85 ),
            0,
            randFace
        ).mul(0.1);

        const wave = time.add(1234)
                        .mul( faceValue.mul( 20 ) )
                        .sin().remap( -1, 1, 1, 2);

       this.material.positionNode = positionLocal.mul(this.radius)
                                        .add(normalLocal.mul(gap).mul(wave));

        return this.material;
    }

    setMesh()
    {
        if (!this.geometry)
        {
            throw new Error('Geometry has not finished loading.');
        }

        if (!this.material)
        {
            throw new Error('Create a material before creating the mesh.');
        }

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        return this.mesh;
    }

    setJunction()
    {   
        const center = objectPosition(this.mesh);
        const sdf = positionWorld
                        .distance(center)
                        .sub(this.radius.add(this.gapRatio.mul(this.junctionRadius)));
        const mask = sdf.negate().step(0);
        const strength = sdf.remapClamp(0, -0.15, 1, 0).mul(mask).pow(3).mul(this.strength)

        const _color = mix(
            this.colorB,
            this.colorA,
            strength
        ).mul(strength)

        this.junctionNode = Fn(() => {
            return vec3(_color);
        })()
    }
}