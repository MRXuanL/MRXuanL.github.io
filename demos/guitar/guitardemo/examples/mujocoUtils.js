import * as THREE from 'three';
import { Reflector  } from './utils/Reflector.js';
import { GuitarDemo } from './main.js';

export async function reloadFunc() {
  // Delete the old scene and load the new scene
  this.scene.remove(this.scene.getObjectByName("MuJoCo Root"));
  [this.model, this.state, this.simulation, this.bodies, this.lights] =
    await loadSceneFromURL(this.mujoco, this.params.scene, this);
  // Reset piano key activations.
  this.prevActivated.fill(false);
  // Run forward dynamics to update the scene.
  this.simulation.forward();
  for (let i = 0; i < this.updateGUICallbacks.length; i++) {
    this.updateGUICallbacks[i](this.model, this.simulation, this.params);
  }
}

/** @param {GuitarDemo} parentContext*/
export function setupGUI(parentContext) {
  // Add song selection dropdown.
  // Parameters:
  // {
  //   "Fur Elise": "fur_elise_actions.npy",
  //   "Little Star": "little_star_actions.npy",
  // } 左侧只是起一个别名，作为下拉框的选项，右侧才是其对应的值
  // .name('Song') 为下拉框的名字
  // .onChange((value) => { }) 为下拉框的值改变时的回调函数
  parentContext.gui.add(parentContext.params, 'song', {
    "happy birthday": "happy_birthday.npy",
    "town": "town.npy",
    "wind song": "wind_song.npy",
  }).name('Song').onChange((value) => {
    parentContext.npyjs.load("./examples/scenes/assets/"+value, (loaded) => {
      parentContext.guitarControl = loaded; //loaded是动作数组
      parentContext.controlFrameNumber = 0;
      parentContext.simulation.resetData();
      parentContext.simulation.forward();
      parentContext.prevActivated.fill(false);
      parentContext.params.songPaused = false;
      parentContext.params.paused=false;
      parentContext.sampler.releaseAll();
    });
  });

  // Kill sound when tab is not visible.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState != "visible") { parentContext.sampler.releaseAll(); }
  });

  // Add a help menu.
  // Parameters:
  //  Name: "Help".
  //  When pressed, a help menu is displayed in the top left corner. When pressed again
  //  the help menu is removed.
  //  Can also be triggered by pressing F1.
  // Has a dark transparent background.
  // Has two columns: one for putting the action description, and one for the action key trigger.keyframeNumber
  let keyInnerHTML = '';
  let actionInnerHTML = '';
  const displayHelpMenu = () => {
    if (parentContext.params.help) {
      const helpMenu = document.createElement('div');
      helpMenu.style.position = 'absolute';
      helpMenu.style.top = '10px';
      helpMenu.style.left = '10px';
      helpMenu.style.color = 'white';
      helpMenu.style.font = 'normal 18px Arial';
      helpMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      helpMenu.style.padding = '10px';
      helpMenu.style.borderRadius = '10px';
      helpMenu.style.display = 'flex';
      helpMenu.style.flexDirection = 'column';
      helpMenu.style.alignItems = 'center';
      helpMenu.style.justifyContent = 'center';
      helpMenu.style.width = '400px';
      helpMenu.style.height = '400px';
      helpMenu.style.overflow = 'auto';
      helpMenu.style.zIndex = '1000';

      const helpMenuTitle = document.createElement('div');
      helpMenuTitle.style.font = 'bold 24px Arial';
      helpMenuTitle.innerHTML = '';
      helpMenu.appendChild(helpMenuTitle);

      const helpMenuTable = document.createElement('table');
      helpMenuTable.style.width = '100%';
      helpMenuTable.style.marginTop = '10px';
      helpMenu.appendChild(helpMenuTable);

      const helpMenuTableBody = document.createElement('tbody');
      helpMenuTable.appendChild(helpMenuTableBody);

      const helpMenuRow = document.createElement('tr');
      helpMenuTableBody.appendChild(helpMenuRow);

      const helpMenuActionColumn = document.createElement('td');
      helpMenuActionColumn.style.width = '50%';
      helpMenuActionColumn.style.textAlign = 'right';
      helpMenuActionColumn.style.paddingRight = '10px';
      helpMenuRow.appendChild(helpMenuActionColumn);

      const helpMenuKeyColumn = document.createElement('td');
      helpMenuKeyColumn.style.width = '50%';
      helpMenuKeyColumn.style.textAlign = 'left';
      helpMenuKeyColumn.style.paddingLeft = '10px';
      helpMenuRow.appendChild(helpMenuKeyColumn);

      const helpMenuActionText = document.createElement('div');
      helpMenuActionText.innerHTML = actionInnerHTML;
      helpMenuActionColumn.appendChild(helpMenuActionText);

      const helpMenuKeyText = document.createElement('div');
      helpMenuKeyText.innerHTML = keyInnerHTML;
      helpMenuKeyColumn.appendChild(helpMenuKeyText);

      // Close buttom in the top.
      const helpMenuCloseButton = document.createElement('button');
      helpMenuCloseButton.innerHTML = 'Close';
      helpMenuCloseButton.style.position = 'absolute';
      helpMenuCloseButton.style.top = '10px';
      helpMenuCloseButton.style.right = '10px';
      helpMenuCloseButton.style.zIndex = '1001';
      helpMenuCloseButton.onclick = () => {
        helpMenu.remove();
      };
      helpMenu.appendChild(helpMenuCloseButton);

      document.body.appendChild(helpMenu);
    } else {
      document.body.removeChild(document.body.lastChild);
    }
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F1') {
      parentContext.params.help = !parentContext.params.help;
      displayHelpMenu();
      event.preventDefault();
    }
  });
  keyInnerHTML += 'F1<br>';
  actionInnerHTML += 'Help<br>';

  let simulationFolder = parentContext.gui.addFolder("Simulation");

  // Add pause simulation checkbox.
  // Parameters:
  //  Under "Simulation" folder.
  //  Name: "Pause Simulation".
  //  When paused, a "pause" text in white is displayed in the top left corner.
  //  Can also be triggered by pressing the spacebar.
  const pauseSimulation = simulationFolder.add(parentContext.params, 'paused').name('Pause Simulation');
  pauseSimulation.onChange((value) => {
    if (value) {
      const pausedText = document.createElement('div');
      pausedText.style.position = 'absolute';
      pausedText.style.top = '10px';
      pausedText.style.left = '10px';
      pausedText.style.color = 'white';
      pausedText.style.font = 'normal 18px Arial';
      pausedText.innerHTML = 'pause';
      parentContext.container.appendChild(pausedText);
    } else {
      parentContext.container.removeChild(parentContext.container.lastChild);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      parentContext.params.paused = !parentContext.params.paused;
      pauseSimulation.setValue(parentContext.params.paused);
      event.preventDefault();
    }
  });
  actionInnerHTML += 'Play / Pause<br>';
  keyInnerHTML += 'Space<br>';

  const pauseSong = simulationFolder.add(parentContext.params, 'songPaused').name('Pause Song').listen();
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP') {
      parentContext.params.songPaused = !parentContext.params.songPaused;
      pauseSong.setValue(parentContext.params.songPaused);
      event.preventDefault();
    }
  });
  actionInnerHTML += 'Play / Pause Song<br>';
  keyInnerHTML += 'P<br>';

  // Add reset simulation button.
  // Parameters:
  //  Under "Simulation" folder.
  //  Name: "Reset".
  //  When pressed, resets the simulation to the initial state.
  //  Can also be triggered by pressing backspace.
  const resetSimulation = () => {
    parentContext.controlFrameNumber = 0;
    parentContext.simulation.resetData();
    parentContext.simulation.forward();
  };
  simulationFolder.add({reset: () => { resetSimulation(); }}, 'reset').name('Reset');
  // document.addEventListener('keydown', (event) => {
  //   if (event.code === 'Backspace') { resetSimulation(); event.preventDefault(); }});
  actionInnerHTML += 'Reset simulation<br>';
  keyInnerHTML += 'Backspace<br>';

  // Add sliders for ctrlnoiserate and ctrlnoisestd; min = 0, max = 2, step = 0.01.
  // simulationFolder.add(parentContext.params, 'ctrlnoiserate', 0.0, 2.0, 0.01).name('Noise rate' );
  // simulationFolder.add(parentContext.params, 'ctrlnoisestd' , 0.0, 2.0, 0.01).name('Noise scale');

  simulationFolder.close();

  // Add actuator sliders.
  // let actuatorFolder = simulationFolder.addFolder("Actuators");
  // const addActuators = (model, simulation, params) => {
  //   let act_range = model.actuator_ctrlrange();
  //   let actuatorGUIs = [];
  //   for (let i = 0; i < model.nu(); i++) {
  //     if (!model.actuator_ctrllimited()[i]) { continue; }
  //     let name = "Actuator " + i;
  //     parentContext.params[name] = 0.0;
  //     let actuatorGUI = actuatorFolder.add(parentContext.params, name, act_range[2 * i], act_range[2 * i + 1], 0.01).name(name).listen();
  //     actuatorGUIs.push(actuatorGUI);
  //     actuatorGUI.onChange((value) => {
  //       simulation.ctrl()[i] = value;
  //     });
  //   }
  //   return actuatorGUIs;
  // };
  // let actuatorGUIs = addActuators(parentContext.model, parentContext.simulation, parentContext.params);
  // parentContext.updateGUICallbacks.push((model, simulation, params) => {
  //   for (let i = 0; i < actuatorGUIs.length; i++) {
  //     actuatorGUIs[i].destroy();
  //   }
  //   actuatorGUIs = addActuators(model, simulation, parentContext.params);
  // });
  // actuatorFolder.close();

  // Add function that resets the camera to the default position.
  // Can be triggered by pressing ctrl + A.
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.code === 'KeyA') {
      parentContext.camera.position.set(0.00402, 0.9, -1.6);
      parentContext.controls.target.set(0.08, -0.01, -0.05);
      parentContext.controls.update();
      event.preventDefault();
    }
  });
  actionInnerHTML += 'Reset free camera<br>';
  keyInnerHTML += 'Ctrl A<br>';

  parentContext.gui.open();
}


/** Loads a scene for MuJoCo
 * @param {mujoco} mujoco This is a reference to the mujoco namespace object
 * @param {string} filename This is the name of the .xml file in the /working/ directory of the MuJoCo/Emscripten Virtual File System
 * @param {GuitarDemo} parent The three.js Scene Object to add the MuJoCo model elements to
 */
export async function loadSceneFromURL(mujoco, filename, parent) {
    // Load in the state from XML.
    parent.model       = mujoco.Model.load_from_xml("/working/"+filename);
    parent.state       = new mujoco.State(parent.model);
    parent.simulation  = new mujoco.Simulation(parent.model, parent.state);

    let model = parent.model;
    let state = parent.state;
    let simulation = parent.simulation;

    // Decode the null-terminated string names.
    let textDecoder = new TextDecoder("utf-8");
    let fullString = textDecoder.decode(model.names());
    let names = fullString.split(textDecoder.decode(new ArrayBuffer(1)));
    console.log(names);
    // Create the root object.
    let mujocoRoot = new THREE.Group();
    mujocoRoot.name = "MuJoCo Root"
    parent.scene.add(mujocoRoot);

    parent.camera.position.set(0.0016, 0.92, -1.55);
    parent.camera.rotation.set(-2.9898,-0.0016579,3.130);
    parent.controls.target.set(0.00157, 0.63, 0.34461);
    parent.controls.update();

    /** @type {Object.<number, THREE.Group>} */
    let bodies = {};
    /** @type {Object.<number, THREE.BufferGeometry>} */
    let meshes = {};
    /** @type {THREE.Light[]} */
    let lights = [];
    /** @type {THREE.BufferGeometry[]} */
    let frets = [];
    // Default material definition.
    let material = new THREE.MeshPhysicalMaterial();
    material.color = new THREE.Color(1, 1, 1);

    // Loop through the MuJoCo sites and recreate them in three.js.
    for(let s = 0; s < model.nsite(); s++) {
      if(!(model.site_group()[s] < 3)) { continue; }
      let b = model.site_bodyid()[s];
      let type = model.site_type()[s];
      let size = [
        model.site_size()[(s*3) + 0],
        model.site_size()[(s*3) + 1],
        model.site_size()[(s*3) + 2]
      ];
      if(type!=mujoco.mjtGeom.mjGEOM_BOX.value) continue;
      // Create the body if it doesn't exist.
      if (!(b in bodies)) {
        bodies[b] = new THREE.Group();
        bodies[b].name = names[b + 1];
        bodies[b].bodyID = b;
        bodies[b].has_custom_mesh = false;
      }
      let geometry = new THREE.BoxGeometry(size[0] * 2.0, size[2] * 2.0, size[1] * 2.0);
      let color = [
        model.site_rgba()[(s * 4) + 0],
        model.site_rgba()[(s * 4) + 1],
        model.site_rgba()[(s * 4) + 2],
        model.site_rgba()[(s * 4) + 3]
      ];
      let material=new THREE.MeshBasicMaterial({color:new THREE.Color(color[0],color[1],color[2])});
      let mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = s == 0 ? false : true;
      mesh.receiveShadow = type != 7;
      mesh.bodyID = b;
      mesh.name=parent.getwholename(model.names(),model.name_siteadr()[s]);
      bodies[b].add(mesh);
      frets.push(mesh);
      getPosition  (model.site_pos (), s, mesh.position  );
      if (type != 0) { getQuaternion(model.site_quat(), s, mesh.quaternion); }
      if (type == 4) { mesh.scale.set(size[0], size[2], size[1]) } // Stretch the Ellipsoid
    } 
    // Loop through the MuJoCo geoms and recreate them in three.js.
    for (let g = 0; g < model.ngeom(); g++) {
      // Only visualize geom groups up to 2 (same default behavior as simulate).
      if (!(model.geom_group()[g] < 3)) { continue; }

      // Get the body ID and type of the geom.
      let b = model.geom_bodyid()[g];
      let type = model.geom_type()[g];
      let size = [
        model.geom_size()[(g*3) + 0],
        model.geom_size()[(g*3) + 1],
        model.geom_size()[(g*3) + 2]
      ];

      // Create the body if it doesn't exist.
      if (!(b in bodies)) {
        bodies[b] = new THREE.Group();
        bodies[b].name = names[b + 1];
        bodies[b].bodyID = b;
        bodies[b].has_custom_mesh = false;
      }

      // Set the default geometry. In MuJoCo, this is a sphere.
      let geometry = new THREE.SphereGeometry(size[0] * 0.5);
      if (type == mujoco.mjtGeom.mjGEOM_PLANE.value) {
        // Special handling for plane later.
      } else if (type == mujoco.mjtGeom.mjGEOM_HFIELD.value) {
        // TODO: Implement this.
      } else if (type == mujoco.mjtGeom.mjGEOM_SPHERE.value) {
        geometry = new THREE.SphereGeometry(size[0]);
      } else if (type == mujoco.mjtGeom.mjGEOM_CAPSULE.value) {
        geometry = new THREE.CapsuleGeometry(size[0], size[1] * 2.0, 20, 20);
      } else if (type == mujoco.mjtGeom.mjGEOM_ELLIPSOID.value) {
        geometry = new THREE.SphereGeometry(1); // Stretch this below
      } else if (type == mujoco.mjtGeom.mjGEOM_CYLINDER.value) {
        geometry = new THREE.CylinderGeometry(size[0], size[0], size[1] * 2.0);
      } else if (type == mujoco.mjtGeom.mjGEOM_BOX.value) {
        geometry = new THREE.BoxGeometry(size[0] * 2.0, size[2] * 2.0, size[1] * 2.0);
      } else if (type == mujoco.mjtGeom.mjGEOM_MESH.value) {
        let meshID = model.geom_dataid()[g];

        if (!(meshID in meshes)) {
          geometry = new THREE.BufferGeometry(); // TODO: Populate the Buffer Geometry with Generic Mesh Data

          let vertex_buffer = model.mesh_vert().subarray(
             model.mesh_vertadr()[meshID] * 3,
            (model.mesh_vertadr()[meshID]  + model.mesh_vertnum()[meshID]) * 3);
          for (let v = 0; v < vertex_buffer.length; v+=3){
            //vertex_buffer[v + 0] =  vertex_buffer[v + 0];
            let temp             =  vertex_buffer[v + 1];
            vertex_buffer[v + 1] =  vertex_buffer[v + 2];
            vertex_buffer[v + 2] = -temp;
          }

          let normal_buffer = model.mesh_normal().subarray(
             model.mesh_vertadr()[meshID] * 3,
            (model.mesh_vertadr()[meshID]  + model.mesh_vertnum()[meshID]) * 3);
          for (let v = 0; v < normal_buffer.length; v+=3){
            //normal_buffer[v + 0] =  normal_buffer[v + 0];
            let temp             =  normal_buffer[v + 1];
            normal_buffer[v + 1] =  normal_buffer[v + 2];
            normal_buffer[v + 2] = -temp;
          }

          let uv_buffer = model.mesh_texcoord().subarray(
             model.mesh_texcoordadr()[meshID] * 2,
            (model.mesh_texcoordadr()[meshID]  + model.mesh_vertnum()[meshID]) * 2);
          let triangle_buffer = model.mesh_face().subarray(
             model.mesh_faceadr()[meshID] * 3,
            (model.mesh_faceadr()[meshID]  + model.mesh_facenum()[meshID]) * 3);
          geometry.setAttribute("position", new THREE.BufferAttribute(vertex_buffer, 3));
          geometry.setAttribute("normal"  , new THREE.BufferAttribute(normal_buffer, 3));
          geometry.setAttribute("uv"      , new THREE.BufferAttribute(    uv_buffer, 2));
          geometry.setIndex    (Array.from(triangle_buffer));
          meshes[meshID] = geometry;
        } else {
          geometry = meshes[meshID];
        }

        bodies[b].has_custom_mesh = true;
      }
      // Done with geometry creation.

      // Set the Material Properties of incoming bodies
      let texture = undefined;
      let color = [
        model.geom_rgba()[(g * 4) + 0],
        model.geom_rgba()[(g * 4) + 1],
        model.geom_rgba()[(g * 4) + 2],
        model.geom_rgba()[(g * 4) + 3]];
      if (model.geom_matid()[g] != -1) {
        let matId = model.geom_matid()[g];
        color = [
          model.mat_rgba()[(matId * 4) + 0],
          model.mat_rgba()[(matId * 4) + 1],
          model.mat_rgba()[(matId * 4) + 2],
          model.mat_rgba()[(matId * 4) + 3]];

        // Construct Texture from model.tex_rgb
        texture = undefined;
        let texId = model.mat_texid()[matId];
        if (texId != -1) {
          let width    = model.tex_width ()[texId];
          let height   = model.tex_height()[texId];
          let offset   = model.tex_adr   ()[texId];
          let rgbArray = model.tex_rgb   ();
          let rgbaArray = new Uint8Array(width * height * 4);
          for (let p = 0; p < width * height; p++){
            rgbaArray[(p * 4) + 0] = rgbArray[offset + ((p * 3) + 0)];
            rgbaArray[(p * 4) + 1] = rgbArray[offset + ((p * 3) + 1)];
            rgbaArray[(p * 4) + 2] = rgbArray[offset + ((p * 3) + 2)];
            rgbaArray[(p * 4) + 3] = 1.0;
          }
          texture = new THREE.DataTexture(rgbaArray, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
          if (texId == 2) {
            texture.repeat = new THREE.Vector2(50, 50);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
          } else {
            texture.repeat = new THREE.Vector2(1, 1);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
          }

          texture.needsUpdate = true;
        }
      }

      material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(color[0], color[1], color[2]),
        transparent: color[3] < 1.0,
        opacity: color[3],
        specularIntensity: model.geom_matid()[g] != -1 ?       model.mat_specular   ()[model.geom_matid()[g]] *0.5 : undefined,
        reflectivity     : model.geom_matid()[g] != -1 ?       model.mat_reflectance()[model.geom_matid()[g]] : undefined,
        roughness        : model.geom_matid()[g] != -1 ? 1.0 - model.mat_shininess  ()[model.geom_matid()[g]] : undefined,
        metalness        : model.geom_matid()[g] != -1 ? 0.1 : undefined,
        map              : texture
      });

      let mesh = new THREE.Mesh();
      if (type == 0) {
        mesh = new Reflector( new THREE.PlaneGeometry( 100, 100 ), { clipBias: 0.003,texture: texture } );
        mesh.rotateX( - Math.PI / 2 );
      } else {
        mesh = new THREE.Mesh(geometry, material);
      }

      mesh.castShadow = g == 0 ? false : true;
      mesh.receiveShadow = type != 7;
      mesh.bodyID = b;
      bodies[b].add(mesh);
      getPosition  (model.geom_pos (), g, mesh.position  );
      if (type != 0) { getQuaternion(model.geom_quat(), g, mesh.quaternion); }
      if (type == 4) { mesh.scale.set(size[0], size[2], size[1]) } // Stretch the Ellipsoid
    }

    // Parse lights.
    for (let l = 0; l < model.nlight(); l++) {
      let light = new THREE.SpotLight();
      if (model.light_directional()[l]) {
        light = new THREE.DirectionalLight();
      } else {
        light = new THREE.SpotLight();
      }
      light.decay = model.light_attenuation()[l] * 100;
      light.penumbra = 0.5;
      light.castShadow = true; // default false

      light.shadow.mapSize.width = 1024; // default
      light.shadow.mapSize.height = 1024; // default
      light.shadow.camera.near = 1; // default
      light.shadow.camera.far = 10; // default
      //bodies[model.light_bodyid()].add(light);
      if (bodies[0]) {
        bodies[0].add(light);
      } else {
        mujocoRoot.add(light);
      }
      lights.push(light);
    }

    for (let b = 0; b < model.nbody(); b++) {
      //let parent_body = model.body_parentid()[b];
      if (b == 0 || !bodies[0]) {
        mujocoRoot.add(bodies[b]);
      } else if(bodies[b]){
        bodies[0].add(bodies[b]);
      } else {
        // console.log("Body without Geometry detected; adding to bodies", b, bodies[b]);
        bodies[b] = new THREE.Group(); bodies[b].name = names[b + 1]; bodies[b].bodyID = b; bodies[b].has_custom_mesh = false;
        bodies[0].add(bodies[b]);
      }
    }

    return [model, state, simulation, bodies, lights, frets]
}

/** Downloads the scenes/examples folder to MuJoCo's virtual filesystem
 * @param {mujoco} mujoco */
export async function downloadExampleScenesFolder(mujoco) {
  let allFiles = [
    "assets/S_ponte-5a1f94048515787d1cdc44d455aa21e2e189def9.obj",
    "assets/S_ghiera_la_e_si-b3e37e8bd77e6bfcf1ed8e7a46377e0c9af78621.obj",
    "assets/cordas_009-c060abace60b17b6a17fe3af5da79e857743fdec.obj",
    "assets/f_distal_pst-927e7e0da0ee76e69c0444b22bade45ff20ab5ee.obj",
    "assets/S_reggiponte-b67ac8c1b871672f1b613cb2669f2478e31e56e9.obj",
    "assets/cassa_001-64fc04b8f91f58a4245b70f7a4708c290b004e23.obj",
    "assets/cordas_001-334fd85d1ad2fdd3f4d6e687f6f338ad09ca4f0d.obj",
    "assets/scene.xml",
    "assets/lf_metacarpal-43a8cbd60c754686e733e10c0c28ff082b46a917.obj",
    "assets/th_proximal-836fc483b89bf08806ab50636ab1fe738a54406e.obj",
    "assets/cordas_008-f59f8fcd957dd82c8db57326398b87171e61dc85.obj",
    "assets/cordas_006-afc289ff3c4a66fc76b9d373affa9a03992332d0.obj",
    "assets/S_manico1-e46313d57c07f0fb380fb1b055445b8bed2c03b9.obj",
    "assets/cordas_007-3e86e789d6be922a0841db0df4e987183928b877.obj",
    "assets/S_Plane2-1c6899b5214a652421ead5ede89dd26d99cc7ff0.obj",
    "assets/palm-20de86ceb3b063e7ca1bf25fa6ddd07c068d6a70.obj",
    "assets/S_manico2-c69bd7db044569b1eaf1584ff2190acec30ca6cd.obj",
    "assets/S_Plane1-4f9094b5bb01e1b7650f9de796c3ff00b769d35a.obj",
    "assets/cordas_004-799a0764c0d2597301306ec2c01ec12fa2c16d70.obj",
    "assets/cordas_002-11a7c12cee07fe1b6346a6d273fa5cad1ab8ffec.obj",
    "assets/cordas_010-6ed511d49dd49f9686837ce91101373bc5216a90.obj",
    "assets/cordas-6c16941ee203a3208fe69feea517d286a614d025.obj",
    "assets/f_knuckle-4e74747ced8908917157e00df691de5cfc71808c.obj",
    "assets/th_middle-c6937ecc6bf6b01a854aaffb71f3beeda05f8ac3.obj",
    "assets/S_reggicinghia-a6fe05d06e0131e3c80c2ec4d5404ba804043916.obj",
    "assets/mounting_plate.obj",
    "assets/S_perno_sol-83b124e1bf7e290ce541b0e16382df779dbf5aab.obj",
    "assets/forearm_collision-3ef43cdb2273599be12fc3270639b8782c869cb4.obj",
    "assets/cordas_003-37899c4d77de907730f47b708883c790140b8834.obj",
    "assets/f_proximal-2b944834ac12ce9bb152073bce3db339405bc76d.obj",
    "assets/forearm_0-20abf0e17ef9afc17a625f75fc0ad21f31b2ff9a.obj",
    "assets/cordas_011-d1a991a25853966819f95050eaee4326f1e18a1d.obj",
    "assets/wrist-87545134a753f219a1f55310cc200489b3a03c47.obj",
    "assets/cordas_005-1ee18191e636fc5cb26ce60a357dedd7eda39700.obj",
    "assets/S_ponticello-4917b49376956ff03fe2190eacaca7a64042c0ed.obj",
    "assets/S_manico-95484acc577fb5677ab24066cc92fe5980604cf6.obj",
    "assets/S_chiave_la-2df10f4bf5039d806accdc00c0f6d19ba09d7a0a.obj",
    "assets/cassa-3e13a7e8ba1f033323a244a521fef0424f0f27a7.obj",
    "assets/S_jack-a1c24f950fd551f37ab43c15e335ab5243d66042.obj",
    "assets/forearm_1-f5b8ac92a6e1b0a6b27c50dac2004867e6c0fb5b.obj",
    "assets/th_distal_pst-c003d5be2d6a841babda3d88c51010617a2ba4bb.obj",
    "assets/S_pirioli-8d19835b9f839b83db1b88b69911c887ca437db3.obj",
    "assets/S_vite_reggicinghia-f187041e6a07fb8cb4ed0e47a74d732e557faa21.obj",
    "assets/S_plancia-4ec80e0aeaa01ed277d2dd25ffea6a0908f57797.obj",
    "assets/S_Circle_031-4947ab654413a9da8ef7a4e4c7ecbe20df19cec9.obj",
    "assets/f_middle-c817011a5fccb8dac0f3201f10aa30ffa74db8b6.obj"
  ];

  let requests = allFiles.map((url) => fetch("./examples/scenes/" + url));
  let responses = await Promise.all(requests);
  for (let i = 0; i < responses.length; i++) {
    let split = allFiles[i].split("/");
    let working = '/working/';
    for (let f = 0; f < split.length - 1; f++) {
        working += split[f];
        if (!mujoco.FS.analyzePath(working).exists) { mujoco.FS.mkdir(working); }
        working += "/";
    }

    if (allFiles[i].endsWith(".png") || allFiles[i].endsWith(".stl") || allFiles[i].endsWith(".skn")) {
        mujoco.FS.writeFile("/working/" + allFiles[i], new Uint8Array(await responses[i].arrayBuffer()));
    } else {
        mujoco.FS.writeFile("/working/" + allFiles[i], await responses[i].text());
    }
  }
}

/** Access the vector at index, swizzle for three.js, and apply to the target THREE.Vector3
 * @param {Float32Array|Float64Array} buffer
 * @param {number} index
 * @param {THREE.Vector3} target */
export function getPosition(buffer, index, target, swizzle = true) {
  if (swizzle) {
    return target.set(
       buffer[(index * 3) + 0],
       buffer[(index * 3) + 2],
      -buffer[(index * 3) + 1]);
  } else {
    return target.set(
       buffer[(index * 3) + 0],
       buffer[(index * 3) + 1],
       buffer[(index * 3) + 2]);
  }
}

/** Access the quaternion at index, swizzle for three.js, and apply to the target THREE.Quaternion
 * @param {Float32Array|Float64Array} buffer
 * @param {number} index
 * @param {THREE.Quaternion} target */
export function getQuaternion(buffer, index, target, swizzle = true) {
  if (swizzle) {
    return target.set(
      -buffer[(index * 4) + 1],
      -buffer[(index * 4) + 3],
       buffer[(index * 4) + 2],
      -buffer[(index * 4) + 0]);
  } else {
    return target.set(
       buffer[(index * 4) + 0],
       buffer[(index * 4) + 1],
       buffer[(index * 4) + 2],
       buffer[(index * 4) + 3]);
  }
}

/** Converts this Vector3's Handedness to MuJoCo's Coordinate Handedness
 * @param {THREE.Vector3} target */
export function toMujocoPos(target) { return target.set(target.x, -target.z, target.y); }

/** Standard normal random number generator using Box-Muller transform */
export function standardNormal() {
  return Math.sqrt(-2.0 * Math.log( Math.random())) *
         Math.cos ( 2.0 * Math.PI * Math.random()); }

