import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Inspector } from 'three/addons/inspector/Inspector.js'
import { SkyMesh } from 'three/addons/objects/SkyMesh.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { bloom } from 'three/examples/jsm/tsl/display/BloomNode.js'
import { materialEmissive, pass, uv } from 'three/tsl'
import { TransformControls } from 'three/addons/controls/TransformControls.js'

import Shield from './Shield'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.threejs')

// Scene
const scene = new THREE.Scene()

// Loaders
const textureLoader = new THREE.TextureLoader()
const gltfLoader = new GLTFLoader()

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 4 * 1.25
camera.position.y = 3
camera.position.z = 2 * 1.25
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 1, 0)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true
})
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0x111111)
renderer.inspector = new Inspector()

/**
 * Post processing
 */
const renderPipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
const scenePassColor = scenePass.getTextureNode('output')
const bloomPass = bloom(scenePassColor)
bloomPass.threshold.value = 0
bloomPass.strength.value = 0.05

renderPipeline.outputNode = scenePassColor.add(bloomPass)

const bloomGui = renderer.inspector.createParameters('Bloom').close()
bloomGui.add(bloomPass.threshold, 'value', 0, 2, 0.01).name('threshold')
bloomGui.add(bloomPass.strength, 'value', 0, 2, 0.01).name('strength')

/**
 * Shield
 */
const hexagonsTexture = await textureLoader.loadAsync('./hexagons.png')
hexagonsTexture.wrapS = THREE.RepeatWrapping
hexagonsTexture.wrapT = THREE.RepeatWrapping

const shield = new Shield(hexagonsTexture);
// shield.mesh.visible = false
scene.add(shield.mesh);

const raycaster = new THREE.Raycaster();

canvas.addEventListener( 'pointerdown', (event) =>{
    const mouse = new THREE.Vector2(
        (event.clientX / sizes.width) * 2 - 1,
        -(event.clientY / sizes.height) * 2 + 1
    )
    
    raycaster.setFromCamera(mouse, camera);

    const sphere = new THREE.Sphere(shield.mesh.position, shield.radius.value);
    let intersect = new THREE.Vector3();
    intersect = raycaster.ray.intersectSphere(sphere, intersect);
    
    if(intersect)
    {
        shield.impacts.add(intersect);
    }
        
})

const shieldGUI = renderer.inspector.createParameters('Shield');
shieldGUI.add(shield.radius, 'value', 0, 5, 0.01).name('radius');
shieldGUI.addColor(shield.colorA, 'value').name('colorA');
shieldGUI.addColor(shield.colorB, 'value').name('colorB');
shieldGUI.add(shield.strength, 'value', 1, 100, 0.01).name('strength');

const transform = new TransformControls(camera, canvas);
transform.attach(shield.mesh);
scene.add(transform.getHelper());

transform.addEventListener('dragging-changed', (event) => {    
    controls.enabled = !event.value;
});

/**
 * Floor
 */
{
    const texture = textureLoader.load('./floor-color.jpg')
    texture.colorSpace = THREE.SRGBColorSpace
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshStandardNodeMaterial({ map: texture, transparent: true })
    )
    mesh.material.opacityNode = uv().sub(0.5).length().smoothstep(0.5, 0.2)
    mesh.material.emissiveNode = materialEmissive.add(shield.junctionNode);
    mesh.rotation.x = - Math.PI * 0.5
    mesh.receiveShadow = true
    mesh.renderOrder = -1
    scene.add(mesh)
}

/**
 * Model
 */
const model = await gltfLoader.loadAsync('./anvil.glb')
model.scene.traverse(child =>
{
    if(child.isMesh)
    {
        child.castShadow = true
        child.receiveShadow = true
        child.material.emissiveNode = materialEmissive.add(shield.junctionNode);
    }
})
scene.add(model.scene)

/**
 * Sky
 */
const sky = new SkyMesh()
sky.scale.setScalar(1000)
scene.add(sky)
const effectController = {
    turbidity: 5.5,
    rayleigh: 1.25,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.35,
    elevation: 0.4,
    azimuth: 52,
    cloudCoverage: 0.4,
    cloudDensity: 0.4,
    cloudElevation: 0.5
}

const sun = new THREE.Vector3()

const skyChanged = () =>
{
    sky.turbidity.value = effectController.turbidity
    sky.rayleigh.value = effectController.rayleigh
    sky.mieCoefficient.value = effectController.mieCoefficient
    sky.mieDirectionalG.value = effectController.mieDirectionalG
    sky.cloudCoverage.value = effectController.cloudCoverage
    sky.cloudDensity.value = effectController.cloudDensity
    sky.cloudElevation.value = effectController.cloudElevation

    const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation )
    const theta = THREE.MathUtils.degToRad( effectController.azimuth )

    sun.setFromSphericalCoords( 1, phi, theta )

    sky.sunPosition.value.copy( sun )
}

skyChanged()

// Debug
const skyGui = renderer.inspector.createParameters('Sky').close()

skyGui.add(effectController, 'turbidity', 0.0, 20.0, 0.1).onChange(skyChanged)
skyGui.add(effectController, 'rayleigh', 0.0, 4, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'mieCoefficient', 0.0, 0.1, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'mieDirectionalG', 0.0, 1, 0.001).onChange(skyChanged)
skyGui.add(effectController, 'elevation', -10, 90, 0.1).onChange(skyChanged)
skyGui.add(effectController, 'azimuth', - 180, 180, 0.1).onChange(skyChanged)

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight(0xffaf85, 3)
directionalLight.castShadow = true
directionalLight.position.set(1, 1, 0.75)
directionalLight.shadow.radius = 5
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

const ambientLight = new THREE.AmbientLight(0x859dff, 1.25)
scene.add(ambientLight)

// Debug
const lightsGui = renderer.inspector.createParameters('Lights').close()

lightsGui.addColor(directionalLight, 'color').name('directionalColor')
lightsGui.add(directionalLight, 'intensity', 0, 5, 0.01).name('directionalIntensity')

lightsGui.addColor(ambientLight, 'color').name('ambientColor')
lightsGui.add(ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')

/**
 * Animate
 */
const tick = () =>
{
    // Update controls
    controls.update()

    // Render
    renderPipeline.render()
}

renderer.setAnimationLoop(tick)
