import { Fn } from 'three/src/nodes/TSL.js';
import { add, color, dot, float, If, Loop, max, mix, mul, normalView, objectPosition, positionLocal, positionViewDirection, positionWorld, texture, time, TWO_PI, uniform, uniformArray, uv, vec2, vec3, vec4 } from 'three/tsl';
import * as THREE from 'three/webgpu'
import gsap from 'gsap';

export default class Shield
{
    constructor(
        _texture,
        radius = 2,
        colorA = color(0x1a5bff),
        colorB = color(0xff2e43),
        strength = 7
    )
    {
        this.texture = _texture;
        this.radius = uniform(radius);
        this.colorA = uniform(colorA);
        this.colorB = uniform(colorB);
        this.strength = uniform(strength);

        this.setImpact();
        this.setGeometry();
        this.setMaterial();
        this.setMesh();
        this.setJunction();
        
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

        this.impacts.add = (position, radius = 1) =>
        {
            const impact = data[ this.impacts.index ];
            const localPosition = this.mesh.worldToLocal(position)
            impact.x = localPosition.x;
            impact.y = localPosition.y;
            impact.z = localPosition.z;

            // impact.w = radius;
            gsap.to(impact, {
                w: radius,
                duration: 0.1,
                ease: 'power2.out',
                onComplete: ()=>
                {
                    gsap.to(impact, {
                        w:0,
                        duration: 1,
                        ease: 'power2.in'
                    })
                }
            })

            this.impacts.index++;
            if(this.impacts.index >= this.impacts.count) this.impacts.index = 0;
        }
        
    }

    setGeometry()
    {
        this.geometry = new THREE.SphereGeometry(1, 32, 32);
    }

    setMaterial()
    {
        this.material = new THREE.MeshBasicNodeMaterial({
            transparent: true,
            blending: THREE.AdditiveBlending,
            color: 0x000000,
            side: THREE.DoubleSide
        });

        this.material.emissiveNode = Fn(() => {

            const finalImpact = float(0)

            Loop(this.impacts.count, ({ i }) =>
            {
                const impactData = this.impacts.uniforms.element(i)
                const impactDistance = impactData.xyz.distance(positionLocal)
                const impact = impactDistance.div(impactData.w).oneMinus().max(0)

                finalImpact.assign(max(finalImpact, impact))
            })
            finalImpact.assign(finalImpact.remap(0.4, 0, 1, 0));

            const fresnel = dot(positionViewDirection, normalView).abs().oneMinus();

            const hexagonsColor = texture(this.texture, uv().mul(vec2(6 , 4)));
            // const hexagonsStep = time.sin().abs()  // can be fub
            const hexagonsStep = max(time.add(hexagonsColor.g.mul(TWO_PI)).sin().remap(-1, 1), finalImpact) // output default is 0 to 1
            const hexagonMask = hexagonsStep.step(hexagonsColor.r)
            const hexagonsPolarMask = uv().y.sub(0.5).abs().remapClamp(0.35, 0.2);
            const hexagonFresnelMask = max(fresnel.pow(2), finalImpact);
            const hexagonFill = max(hexagonsColor.r, finalImpact)
            const hexagons = mul(
                hexagonMask,
                hexagonsColor.b,
                hexagonsPolarMask,
                hexagonFresnelMask,
                hexagonFill
            );

            const lineStrength = positionWorld.y
                                    .mul(3)
                                    .sub(time)
                                    .sin()
                                    .remap(-1, 1, 0 , 1)
                                    .mul(0.05)

            const lines = positionWorld.y
                            .mul(20)
                            .add(time)
                            .fract()
                            .pow(3)
                            .mul(lineStrength)

            const emissiveStrength= add(
                hexagons,
                fresnel.pow(5),
                lines
            ).mul(this.strength);

            const emissive = mix(
                this.colorA,
                this.colorB,
                emissiveStrength
            ).mul(emissiveStrength);
            
            return vec3(emissive);
        })()

        this.material.positionNode = positionLocal.mul(this.radius)
    }

    setMesh()
    {
        this.mesh = new THREE.Mesh(
            this.geometry,
            this.material
        );
    }

    setJunction()
    {   
        const center = objectPosition(this.mesh);
        const sdf = positionWorld
                        .distance(center)
                        .sub(this.radius);
        const mask = sdf.negate().step(0);
        const strength = sdf.remapClamp(0, -0.2, 1, 0).mul(mask).pow(3).mul(this.strength)

        const _color = mix(
            this.colorA,
            this.colorB,
            strength
        ).mul(strength)

        this.junctionNode = Fn(() => {
            return vec3(_color);
        })()
    }
}