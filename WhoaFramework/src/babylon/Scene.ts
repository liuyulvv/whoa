import {
    Engine as BabylonEngine,
    Mesh as BabylonMesh,
    Scene as BabylonScene,
    BoundingInfo,
    MeshBuilder,
    PointerEventTypes,
    PointerInfo,
    SceneLoader,
    VertexData
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import { Color3, Color4 } from 'src/math/Color';
import { Matrix } from 'src/math/Matrix';
import { Vector3 } from 'src/math/Vector';
import { Camera2D, Camera3D, CameraMode } from './Camera';

export interface PickInfo {
    hit: boolean;
    meshID: string;
}

export default class Scene {
    private static instance: Scene;
    private readonly canvas: HTMLCanvasElement;
    private readonly engine: BabylonEngine;
    private readonly scene: BabylonScene;
    private readonly camera2D: Camera2D;
    private readonly camera3D: Camera3D;
    private readonly builder = MeshBuilder;
    private readonly groundMesh: BabylonMesh;
    private cameraMode: CameraMode;

    private constructor() {
        this.canvas = WhoaCanvas;
        this.engine = new BabylonEngine(this.canvas);
        this.scene = new BabylonScene(this.engine);
        this.scene.clearColor = new Color4(1.0, 1.0, 1.0, 1.0);
        this.scene.useRightHandedSystem = true;
        const helper = this.scene.createDefaultEnvironment({
            environmentTexture: '/assets/env/environmentSpecular.env',
            createGround: false,
            createSkybox: false
        });
        helper?.setMainColor(new Color3(1.0, 1.0, 1.0));
        this.camera2D = new Camera2D(this.engine, this.scene);
        this.camera3D = new Camera3D(this.engine, this.scene);
        this.enableCameraInput();
        this.groundMesh = MeshBuilder.CreatePlane(
            'ground',
            { width: 1000000, height: 1000000, sideOrientation: VertexData.BACKSIDE },
            this.scene
        );
        this.groundMesh.isPickable = false;
        const groundMeshMaterial = new GridMaterial('ground', this.scene);
        groundMeshMaterial.majorUnitFrequency = 0;
        groundMeshMaterial.minorUnitVisibility = 0.5;
        groundMeshMaterial.gridRatio = 1000;
        groundMeshMaterial.useMaxLine = true;
        groundMeshMaterial.opacity = 0.5;
        this.groundMesh.material = groundMeshMaterial;

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
        WhoaEvent.sub('WHOA_WINDOW_RESIZE', () => {
            this.resize();
        });
        this.resize();
        this.cameraMode = CameraMode.MODE_2D;
        WhoaEvent.sub('CHANGE_TO_2D_CAMERA', () => {
            this.changeTo2D();
        });
        WhoaEvent.sub('CHANGE_TO_3D_CAMERA', () => {
            this.changeTo3D();
        });
        this.changeTo2D();
        this.addPointerWheel();
    }

    public static get(): Scene {
        if (!Scene.instance) {
            Scene.instance = new Scene();
        }
        return Scene.instance;
    }

    public resize(): void {
        this.engine.resize();
        this.camera2D.setOrthoCameraTopBottom(this.canvas.height / this.canvas.width);
    }

    public release(): void {
        this.engine.dispose();
    }

    public getCameraMode(): CameraMode {
        return this.cameraMode;
    }

    private changeTo2D(): void {
        this.camera2D.attach();
        this.cameraMode = CameraMode.MODE_2D;
    }

    private changeTo3D(): void {
        this.camera3D.attach();
        this.cameraMode = CameraMode.MODE_3D;
    }

    public screenToWorld(point: WhoaMath.Point2): WhoaMath.Point3 {
        const unproject = Vector3.Unproject(
            new Vector3(point.x, point.y, 0),
            this.engine.getRenderWidth(),
            this.engine.getRenderHeight(),
            Matrix.Identity(),
            this.scene.getViewMatrix(),
            this.scene.getProjectionMatrix()
        );
        const res = new WhoaMath.Point3(unproject.x, unproject.y, unproject.z);
        return res;
    }

    public worldToScreen(point: WhoaMath.Point3): WhoaMath.Point2 {
        const res = new WhoaMath.Point2();
        if (this.getCameraMode() == CameraMode.MODE_2D) {
            const project = Vector3.Project(
                new Vector3(point.x, point.y, point.z),
                Matrix.Identity(),
                this.scene.getTransformMatrix(),
                this.camera2D.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight())
            );
            res.x = project.x;
            res.y = project.y;
        } else {
            const project = Vector3.Project(
                new Vector3(point.x, point.y, point.z),
                Matrix.Identity(),
                this.scene.getTransformMatrix(),
                this.camera3D.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight())
            );
            res.x = project.x;
            res.y = project.y;
        }
        return res;
    }

    public getScreenPosition(): WhoaMath.Point2 {
        return new WhoaMath.Point2(this.scene.pointerX, this.scene.pointerY);
    }

    public getGroundPosition(): WhoaMath.Point3 {
        const babylonPickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
            return mesh == this.groundMesh;
        });
        if (babylonPickInfo.hit && babylonPickInfo.pickedPoint) {
            return new WhoaMath.Point3(
                babylonPickInfo.pickedPoint.x,
                babylonPickInfo.pickedPoint.y,
                babylonPickInfo.pickedPoint.z
            );
        }
        return new WhoaMath.Point3(0, 0, 0);
    }

    public setEntityHoverColor(): void {
        this.scene.getBoundingBoxRenderer().frontColor = Color3.FromHexString('#479ef5');
        this.scene.getBoundingBoxRenderer().backColor = Color3.FromHexString('#479ef5');
    }

    public setEntitySelectColor(): void {
        this.scene.getBoundingBoxRenderer().frontColor = Color3.FromHexString('#5b5fc7');
        this.scene.getBoundingBoxRenderer().backColor = Color3.FromHexString('#5b5fc7');
    }

    public pickEntity(): PickInfo {
        const babylonPickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        const pickInfo: PickInfo = {
            hit: babylonPickInfo.hit,
            meshID: babylonPickInfo.pickedMesh ? babylonPickInfo.pickedMesh.id : ''
        };
        return pickInfo;
    }

    public enableCameraInput(): void {
        this.camera2D.enableCameraInput();
        this.camera3D.enableCameraInput();
    }

    public disableCameraInput(): void {
        this.camera2D.disableCameraInput();
        this.camera3D.disableCameraInput();
    }

    public get MeshBuilder(): typeof MeshBuilder {
        return this.builder;
    }

    public importMeshAsync(baseURL: string, meshName: string, entityID: string) {
        return SceneLoader.ImportMeshAsync('', baseURL, meshName, this.scene).then((result) => {
            const meshes: BabylonMesh[] = [];
            result.meshes.forEach((mesh) => {
                mesh.id = entityID;
                const childMeshes = mesh.getChildMeshes();
                if (childMeshes.length > 0) {
                    let min = childMeshes[0].getBoundingInfo().boundingBox.minimumWorld;
                    let max = childMeshes[0].getBoundingInfo().boundingBox.maximumWorld;
                    for (let i = 0; i < childMeshes.length; i++) {
                        const meshMin = childMeshes[i].getBoundingInfo().boundingBox.minimumWorld;
                        const meshMax = childMeshes[i].getBoundingInfo().boundingBox.maximumWorld;
                        min = Vector3.Minimize(min, meshMin);
                        max = Vector3.Maximize(max, meshMax);
                    }
                    mesh.setBoundingInfo(new BoundingInfo(min, max));
                    meshes.push(mesh as BabylonMesh);
                }
            });
            return meshes;
        });
    }

    public addPointerWheel(): void {
        let wheelEventStart: number | undefined = undefined;
        let wheelEventTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
        const wheelEventThresh = 300;
        const wheelEventTimeoutCallback = () => {
            const currentTime = Date.now();
            if (currentTime - wheelEventStart! > wheelEventThresh) {
                WhoaEvent.pub('POINTER_WHEEL_END');
                wheelEventStart = undefined;
            } else {
                clearTimeout(wheelEventTimeout);
                wheelEventTimeout = setTimeout(wheelEventTimeoutCallback, wheelEventThresh);
            }
        };
        this.scene.onPointerObservable.add((pointerInfo: PointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERWHEEL: {
                    if (wheelEventStart == undefined) {
                        WhoaEvent.pub('POINTER_WHEEL_START');
                        wheelEventStart = Date.now();
                        wheelEventTimeout = setTimeout(wheelEventTimeoutCallback, wheelEventThresh);
                    } else {
                        wheelEventStart = Date.now();
                    }
                    break;
                }
            }
        });
    }
}
