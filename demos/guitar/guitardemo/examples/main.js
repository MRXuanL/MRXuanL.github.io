import * as THREE           from 'three';
import { GUI              } from '../node_modules/three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls    } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { DragStateManager } from './utils/DragStateManager.js';
import  npyjs               from './utils/npy.js';
import { fret2note }         from './utils/musicUtils.js';
import { setupGUI, downloadExampleScenesFolder, loadSceneFromURL, getPosition, getQuaternion, toMujocoPos, standardNormal } from './mujocoUtils.js';
import   load_mujoco        from '../dist/mujoco_wasm.js';
import { Table } from './utils/table.js';
const mujoco = await load_mujoco();

var initialScene= "assets/scene.xml";
mujoco.FS.mkdir('/working');
mujoco.FS.mount(mujoco.MEMFS,{root:'.'},'/working');


export class GuitarDemo {
    constructor() {
        this.mujoco = mujoco;
        // Activate Audio upon first interaction.
        document.addEventListener('pointerdown', () => {
            if (Tone.context.state !== "running") { Tone.context.resume(); }
        });
        
        // this.table=new Table();
        // this.inputTable=new Table(4,4,"inputTable",60,0,80,110);
        // Define Random State Variables
        this.params = { song: "happy_birthday.npy", paused: false, songPaused: false, help: false, ctrlnoiserate: 0.0, ctrlnoisestd: 0.0, keyframeNumber: 0 };
        this.mujoco_time = 0.0;
        this.bodies  = {}, this.lights = {};
        this.tmpVec  = new THREE.Vector3();
        this.tmpQuat = new THREE.Quaternion();
        this.updateGUICallbacks = [];
        this.controlFrameNumber = 0;
    
        this.container = document.createElement( 'div' );
        document.body.appendChild( this.container );//往页面中添加container

        this.scene = new THREE.Scene();
        this.scene.name = 'scene';
        this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.001, 100 );
        this.camera.name = 'PerspectiveCamera'; //添加透视相机
        this.camera.position.set( 0.00402, 0.9, -1.6 );
        this.camera.up.set( 0, 0, 1 );
        this.scene.add(this.camera);
    
        this.ambientLight = new THREE.AmbientLight( 0xffffff, 1 );
        this.ambientLight.name = 'AmbientLight';
        this.scene.add( this.ambientLight );
    
        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.setClearColor(0x0080A6);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
        this.renderer.setAnimationLoop( this.render.bind(this) );
    
        this.container.appendChild( this.renderer.domElement ); //添加渲染器
    
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.panSpeed = 2;
        this.controls.zoomSpeed = 1;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.10;
        this.controls.screenSpacePanning = true;
        this.controls.update();  //轨道控制器
    
        // Music-related variables.
        this.prevActivated = new Array(6).fill(-1); //吉他6根弦
        this.sampler = new Tone.Sampler({
            urls: {
            A2: "A2.mp3",
            A3: "A3.mp3",
            A4: "A4.mp3",
            B2: "B2.mp3",
            B3: "B3.mp3",
            B4: "B4.mp3",
            C3: "C3.mp3",
            C4: "C4.mp3",
            C5: "C5.mp3",
            D3: "D3.mp3",
            D4: "D4.mp3",
            D5: "D5.mp3",
            E2: "E2.mp3",
            E3: "E3.mp3",
            E4: "E4.mp3",
            F2: "F2.mp3",
            F3: "F3.mp3",
            F4: "F4.mp3",
            G2: "G2.mp3",
            G3: "G3.mp3",
            G4: "G4.mp3",
            "C#3": "Cs3.mp3",
            "C#4": "Cs4.mp3",
            "C#5": "Cs5.mp3",
            "D#2": "Ds2.mp3",
            "D#3": "Ds3.mp3",
            "D#4": "Ds4.mp3",
            "F#2": "Fs2.mp3",
            "F#3": "Fs3.mp3",
            "F#4": "Fs4.mp3",
            "G#2": "Gs2.mp3",
            "G#3": "Gs3.mp3",
            "G#4": "Gs4.mp3",
            "A#2": "As2.mp3",
            "A#3": "As3.mp3",
            "A#4": "As4.mp3",
            },
            baseUrl: "examples/guitar-acoustic/",
        }).toDestination(); //添加吉他采样器
    
        window.addEventListener('resize', this.onWindowResize.bind(this));
    
        // Initialize the Drag State Manager.
        this.dragStateManager = new DragStateManager(this.scene, this.renderer, this.camera, this.container.parentElement, this.controls);
    }
  
    async init() {
        // Download the the examples to MuJoCo's virtual file system
        await downloadExampleScenesFolder(mujoco);
        //把scenes里的文件下载到虚拟Mujoco文件系统中
        // Initialize the three.js Scene using the .xml Model in initialScene
        [this.model, this.state, this.simulation, this.bodies, this.lights, this.frets] =
            await loadSceneFromURL(mujoco, initialScene, this);
        //从loadSceneFromURL获得this.model, state, simulation, bodies, lights.
        this.gui = new GUI();
        setupGUI(this);
        // this.addInputEventListeners();
        // this.buildWebsocket();
        this.npyjs = new npyjs();
        this.npyjs.load("./examples/scenes/assets/"+this.params.song, (loaded) => {
            this.guitarControl = loaded;
            //this.guitarControl 为两个手的joint qpos的数据,其中前24个是左手(前20个是左手的ctrl)，后22个是右手，最后6个是对应的弦的拨弦状态
            this.controlFrameNumber = 0;
        }); //导入动作数组
    }
    updateInputTable(){
        this.resetInputTable();
        let positions=[];
        for(let i =0;i<6;i++){
            if(this.inputs[i].value!=""){
                this.inputs[i].value=Math.max(0,Math.min(14,Number(this.inputs[i].value)));
                positions.push({str:i+1,fret:Number(this.inputs[i].value)});
            }
        }
        const notetype=document.getElementById("notetype").value;
        const duration=document.getElementById("duration").value+(notetype=="normal"?"":"r");
        console.log("inputTable duration:",duration);
        this.inputTable.addNote(positions,duration);
        // console.log(draw);
        this.inputTable.draw();
    }
    resetGuitarControl(text){
        const lines=text.split('\n');
        let cnt=0;
        this.guitarControl.data=[];
        lines.forEach((line, index) => {
            this.guitarControl.data.push(parseFloat(line));
            cnt++;
        });
        cnt--;
        console.log(cnt);
        this.guitarControl.data.pop();
        this.guitarControl.shape[0]=Number(cnt/172);
        console.log(this.guitarControl.data);
        console.log(this.guitarControl.shape[0]);
        this.controlFrameNumber=0;
        this.simulation.resetData();
        this.simulation.forward();
        this.prevActivated.fill(false);
        this.params.songPaused = false;
        this.params.paused=false;
        this.sampler.releaseAll();
    }
    buildWebsocket(){
        // this.ws=new WebSocket('ws://localhost:8888');
        // this.ws.onmessage=(event)=>{
        //     this.recieveData=event.data;
        //     // console.log(this.recieveData);
        //     this.resetGuitarControl(this.recieveData);
        // }
        // this.ws.onclose=(event)=>{
        //     console.log("websocket closed");
        // }
        // this.ws.onopen=(event)=>{
        //     console.log("websocket opened");
        // }
        // this.ws.onerror=((event)=>{
        //     alert("websocket error");
        // })
    }
    updateTable(){
        let positions=[];
        for(let i =0;i<6;i++){
            if(this.inputs[i].value!=""){
                positions.push({str:i+1,fret:Number(this.inputs[i].value)});
                this.inputs[i].value="";
            }
        }
        const notetype=document.getElementById("notetype").value;
        const duration=document.getElementById("duration").value+(notetype=="normal"?"":"r");
        console.log("table duration:",duration);
        this.table.addNote(positions,duration);
        this.table.draw();
        this.resetInputTable();
    }
    resetInputTable(){
        this.inputTable.reset(4,4,"inputTable",60,0,80,110);
    }
    addInputEventListeners(){
        this.inputs=[];
        for (let i = 1; i <= 6; i++){
            this.inputs.push(document.getElementsByName("string"+i)[0]);
        }
        for (let i = 0; i < 6; i++){
            this.inputs[i].addEventListener("input", (e) => {
                this.updateInputTable();
            });
        }
        document.getElementById("notetype").addEventListener("change", (e) => {
            this.updateInputTable();
        });
        document.getElementById("duration").addEventListener("change", (e) => {
            this.updateInputTable();
        });
        document.getElementById("addnote").addEventListener("click", (e) => {
            this.updateTable();
        });
        document.getElementById("bpm").addEventListener("change", (e) => {
            // console.log(e.target.value,"bpm设置成功");
            this.table.resetBPM(Number(e.target.value));
        })
        document.getElementById("addmeasure").addEventListener("click", (e) => {
            this.table.addMeasure();
            this.table.draw();
        });
        document.getElementById("reset").addEventListener("click",(e)=>{
            this.table.reset();
        })
        document.getElementById("play").addEventListener("click", (e) => {
            this.ws.send(this.table.toTarget());
        });
    }
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    }
  
    processGuitarState() {
        if(this.controlFrameNumber%10!=0){
            return;
        }
        let activation = new Array(120).fill(false);
        let stringactivation = new Array(6).fill(0); //每个弦的最大激活品位
        
        for (let s = 0; s < 120; s++){
            activation[s] = this.guitarControl.data[172*Math.floor(this.controlFrameNumber/10.0) + s+46]>=1;
        }
        
        // update frets state
        for (let f = 0; f < 120; f++){
            this.frets[f].visible = activation[f];
            if(activation[f]) {
                this.frets[f].material.color.setRGB(0.1,0.9,0.4);
                stringactivation[f%6]=Math.floor(f/6)+1;
            }
            else this.frets[f].material.color.setRGB(0.9,0.0,0.0);
        }

        // xor the current activation with the previous activation.
        let state_change = new Array(6).fill(false);
        for (let i = 0; i < 6; i++) {
            state_change[i] = stringactivation[i] != this.prevActivated[i];//获取改变的状态
        }
        //todo:
        //    将每一帧应该控制的弦的记录在一个单独的数组中:stringpluck从guitarcontrol中提取出来
        
        for(let i = 0; i < 6; i++){
            let needpluck = this.guitarControl.data[172*Math.floor(this.controlFrameNumber/10.0)+ Math.floor( i + 166)]>0.5;
            if(needpluck){
                let note=fret2note(i, stringactivation[i]);
                console.log(i+1,stringactivation[i],note);
                this.sampler.triggerAttackRelease(note,2);//激活音频
            }
        }
        // Update the previous activation.
        for (let i = 0; i < 6; i++) {
            this.prevActivated[i] = stringactivation[i];//更新激活的弦对应的品位
        }
    }

    processHandPos(){
        // let right_hand=[];
        
        let currentqpos=this.simulation.qpos();
        let currentqvel=this.simulation.qvel();
        
        for(let qv=0;qv<this.model.nq();qv++){
            currentqvel[qv]=0;
        }
        for(let qp=0;qp<this.model.nq();qp++){
            currentqpos[qp]=this.guitarControl.data[(172*Math.floor(this.controlFrameNumber / 10.0)) + qp];
        }
        // console.log(currentqpos);

        if (this.controlFrameNumber >= (this.guitarControl.shape[0]) * 10) {
            //曲子播放完了，重置环境，暂停曲子的播放
            this.controlFrameNumber = 0;
            this.simulation.resetData();
            this.simulation.forward();
            this.params.songPaused = true;
            this.params.paused = true; 
        }

    }
    testModelName(){
        let namesensoradr=this.model.name_sensoradr();
        for(let id=0; id<this.model.nsensor();id++){
            let nameadr=namesensoradr[id];
            let sensoradr=this.model.sensor_adr()[id];
            let sensordim=this.model.sensor_dim()[id];
            console.log(this.getwholename(this.model.names(),nameadr),sensoradr,sensordim);
        }
    }
    getwholename(names,nameadr){
        let ans="";
        for(let i=nameadr;names[i]!=0;i++)
            ans+=String.fromCharCode(names[i]);
        return ans;
    }
    
    render(timeMS) {
        this.controls.update();
        // // Return if the model hasn't been loaded yet
        if (!this.model) { return; }
        if (!this.guitarControl) { return; }
        //this.testModelName();
        if (!this.params["paused"]) {
            let timestep = this.model.getOptions().timestep;
            if (timeMS - this.mujoco_time > 35.0) { this.mujoco_time = timeMS; }
            while (this.mujoco_time < timeMS) {
    
                // Jitter the control state with gaussian random noise
                if (this.guitarControl && !this.params.songPaused) {
                    this.processHandPos();
                }
                for (let i = 0; i < this.simulation.qfrc_applied().length; i++) { this.simulation.qfrc_applied()[i] = 0.0; }
                let dragged = this.dragStateManager.physicsObject;
                if (dragged && dragged.bodyID) {
                for (let b = 0; b < this.model.nbody(); b++) {
                    if (this.bodies[b]) {
                        getPosition  (this.simulation.xpos (), b, this.bodies[b].position);
                        getQuaternion(this.simulation.xquat(), b, this.bodies[b].quaternion);
                        //根据simulation的xpos更新Three.js中的body模型
                        this.bodies[b].updateWorldMatrix();
                    }
                }
                let bodyID = dragged.bodyID;
                this.dragStateManager.update(); // Update the world-space force origin
                let force = toMujocoPos(this.dragStateManager.currentWorld.clone()
                    .sub(this.dragStateManager.worldHit)
                    .multiplyScalar(Math.max(1, this.model.body_mass()[bodyID]) * 250)); //
                let point = toMujocoPos(this.dragStateManager.worldHit.clone());
                this.simulation.applyForce(force.x, force.y, force.z, 0, 0, 0, point.x, point.y, point.z, bodyID);
                //拉取事件，给对应点击的body施加力
                // TODO: Apply pose perturbations (mocap bodies only).
                }
                this.simulation.step();  
                //传递
                if(this.guitarControl&& !this.params.songPaused) this.processGuitarState();
                this.controlFrameNumber += 1;//控制帧+1
                //更新钢琴状态
                this.mujoco_time += timestep * 1000.0;
            // 更新时间
            }
    
        } else if (this.params["paused"]) {
            this.simulation.resetData();
            this.simulation.forward();
            this.sampler.releaseAll();
            //暂停的话，只需要forward就可以了，并且释放所有的音乐
        }
  
        // // Update body transforms.
        for (let b = 0; b < this.model.nbody(); b++) {
            if (this.bodies[b]) {
                getPosition  (this.simulation.xpos (), b, this.bodies[b].position);
                getQuaternion(this.simulation.xquat(), b, this.bodies[b].quaternion);
                this.bodies[b].updateWorldMatrix();
            }
        }
    
        // Update light transforms.
        for (let l = 0; l < this.model.nlight(); l++) {
            if (this.lights[l]) {
                getPosition(this.simulation.light_xpos(), l, this.lights[l].position);
                getPosition(this.simulation.light_xdir(), l, this.tmpVec);
                this.lights[l].lookAt(this.tmpVec.add(this.lights[l].position));
            }
        }
    
        // Render!
        // console.log(this.camera.position);
        // console.log(this.camera.up);
        // console.log(this.camera.rotation);
        // console.log(this.controls.target);
        this.renderer.render( this.scene, this.camera );
    }
}
  
let demo = new GuitarDemo();
await demo.init();