import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { add, attribute, color, dot, mix, mul, normalLocal, normalView, objectPosition, positionLocal, positionViewDirection, positionWorld, select, texture, time, uv, vec3, vec4, Fn, uniform, uniformArray, float, Loop, max, min} from 'three/tsl';
import gsap from 'gsap';

export default class Shield2
{
    constructor(
        ShieldUv, 
        radius = 2, 
        gapRatio = 1.5,
        colorA = color(0xb224ff),
        colorB = color(0x758cff),
        strength = 25
    )
    {   
        this.uvTexture = ShieldUv;
        this.radius = uniform(radius);
        this.gapRatio = uniform(gapRatio);
        this.colorA = uniform(colorA);
        this.colorB = uniform(colorB);
        this.strength = uniform(strength);

        this.ready = this.initialize();
    }

    async initialize()
    {
        this.setImpact();
        await this.setGeometry();
        this.setMaterial();
        this.setMesh();
        this.setJunction();

        return this.mesh;
    }

    setImpact()
    {
        this.impacts = {};
        this.impacts.count = 5;
        this.impacts.index = 0;

        //uniform array
        const data = [];
        for(let i=0; i< this.impacts.count; i++)
            data.push(new THREE.Vector4(0, 0, 0, 0));
        
        this.impacts.uniforms = uniformArray(data, 'vec4');
        this.impacts.add = (position, radius = 1.5) =>
        {
            const impact = data[ this.impacts.index ];
            const localPosition = this.mesh.worldToLocal(position)
            impact.x = localPosition.x;
            impact.y = localPosition.y;
            impact.z = localPosition.z;
            
            // impact.w = radius;
            gsap.to(impact, {
                w: radius,
                duration: 0.12,
                ease: 'power3.out',
                onComplete: ()=>
                {
                    gsap.to(impact, {
                        w:0,
                        duration: 1.8,
                        ease: 'sine.inOut'
                    })
                }
            })

            this.impacts.index++;
            if(this.impacts.index >= this.impacts.count) this.impacts.index = 0;
            
        };
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
        throw new Error('No mesh');
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

            const finalImpact = float(0);

            Loop(this.impacts.count, ({ i }) =>
            {
                const impactData = this.impacts.uniforms.element(i)
                const impactDistance = impactData.xyz.distance(positionLocal)
                const impact = impactDistance.div(impactData.w).oneMinus().max(0)
                
                finalImpact.assign(max(finalImpact, impact))
            });

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

            const finalColor = 
                emissiveStrength.r.mul(this.strength)
                
            ;
            const baseAlpha = finalColor.a.mul(fresnel.pow(4));
            const impactAlpha = finalColor.a
                                    .mul(finalImpact.pow(3)) // makes the edge fall off more softly
                                    .mul(2);              // impact alpha strength

            finalColor.a = max(baseAlpha, impactAlpha);

            let fColor = mix(
                this.colorB,
                this.colorA,
                finalColor.r
            );
            return vec4(fColor.rgb, finalColor.a);
        })();


        this.material.positionNode = Fn(()=>
        {

            const gapRatio = this.gapRatio.mul(0.1);
            const gap = this.radius.mul(gapRatio);

            const randFace = attribute('_randface', 'float');
            
            const surfacePosition = positionLocal.mul(this.radius.mul(add(randFace, gapRatio)));

            const finalImpact = float(0);

            Loop(this.impacts.count, ({ i }) => {
                const impactData = this.impacts.uniforms.element(i);

                const distanceToImpact = impactData.xyz.distance(surfacePosition);

                const impact = select(
                    impactData.w.greaterThan(0), // ignores unused impacts
                    distanceToImpact.div(impactData.w).oneMinus().max(0),
                    0
                );

                finalImpact.assign(max(finalImpact, impact));
            });

            

            const faceValue = select(
                randFace.lessThan( 0.85 ),
                0,
                randFace
            ).mul(0.1);

            const wave = time.add(1234)
                            .mul( faceValue.mul( 20 ) )
                            .sin().remap( -1, 1, 1, 2);

            const impactHeight = finalImpact.mul(1.5);
            
            return positionLocal
                    .mul(this.radius)
                    .add(normalLocal.mul(gap).mul(wave))
                    .add(normalLocal.mul(impactHeight));

        })()

        return this.material;
    }

    setMesh()
    {
        if (!this.geometry)
        {
            throw new Error('not finished loading');
        }

        if (!this.material)
        {
            throw new Error('No Material');
        }

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        return this.mesh;
    }

    setJunction()
    {   
        const center = objectPosition(this.mesh);
        const sdf = positionWorld
                        .distance(center)
                        .sub(this.radius.add(this.gapRatio.mul(0.15, this.radius)));
        const mask = sdf.negate().step(0);
        const strength = sdf.remapClamp(0, -0.15, 1, 0).mul(mask).pow(3).mul(this.strength);

        const _color = mix(
            this.colorB,
            this.colorA,
            strength
        ).mul(strength);

        this.junctionNode = Fn(() => {
            return vec3(_color);
        })()
    }
}