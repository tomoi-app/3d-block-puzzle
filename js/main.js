// js/main.js
const GRID_SIZE = 12;

let scene, camera, renderer, controls;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let characterGroup;
let lastTime = 0, dropTimer = 0;
const dropInterval = 800;

// ゲーム状態
let isGameOver = false;
let charGridPos = { x: 5, z: 5 }; // キャラクターの現在位置
let charHeight = 0;

// ジョイスティック用
let activeDir = null;
let moveTimer = 0;
const moveInterval = 150;

const SHAPES = [
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:-1,y:1,z:0}], // L
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:2,y:0,z:0}],  // I
    [{x:0,y:0,z:0}, {x:-1,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}],  // T
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}, {x:1,y:1,z:0}]    // O
];

function init() {
    const container = document.getElementById('game-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    // カメラの初期位置を少し遠ざける（引き絵）
    camera.position.set(GRID_SIZE/2, 25, GRID_SIZE + 15);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(GRID_SIZE/2, 0, GRID_SIZE/2);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000);
    gridHelper.position.set(GRID_SIZE/2 - 0.5, 0, GRID_SIZE/2 - 0.5);
    scene.add(gridHelper);

    translationGroup = new THREE.Group();
    rotationGroup = new THREE.Group();
    blockGroup = new THREE.Group();
    landedBlocksGroup = new THREE.Group();

    translationGroup.add(rotationGroup);
    rotationGroup.add(blockGroup);
    scene.add(translationGroup);
    scene.add(landedBlocksGroup);

    initCharacter();
    setupUI();
    startGame();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    requestAnimationFrame(animate);
}

function initCharacter() {
    characterGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16);
    const bodyMat = new THREE.MeshLambertMaterial({color: 0xffffff});
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    characterGroup.add(body);
    scene.add(characterGroup);
}

function startGame() {
    isGameOver = false;
    charGridPos = { x: 5, z: 5 };
    charHeight = 0;
    while(landedBlocksGroup.children.length > 0) landedBlocksGroup.remove(landedBlocksGroup.children[0]);
    document.getElementById('game-over-screen').style.display = 'none';
    spawnBlock();
}

function spawnBlock() {
    while(blockGroup.children.length > 0) blockGroup.remove(blockGroup.children[0]);
    rotationGroup.rotation.set(0, 0, 0);
    
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    shape.forEach(pos => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y, pos.z);
        blockGroup.add(mesh);
    });

    // カメラの高さより少し上に出現
    const spawnY = Math.max(15, controls.target.y + 15);
    translationGroup.position.set(Math.floor(GRID_SIZE/2), spawnY, Math.floor(GRID_SIZE/2));
}

// 厳密な当たり判定
function checkCollision(targetX, targetY, targetZ) {
    let hasCollision = false;
    const cubes = blockGroup.children;
    
    // 仮のクォータニオンを計算して子要素の世界座標を予測
    const tempGroup = new THREE.Group();
    tempGroup.position.set(targetX, targetY, targetZ);
    const tempRotGroup = new THREE.Group();
    tempRotGroup.rotation.copy(rotationGroup.rotation);
    tempGroup.add(tempRotGroup);
    
    cubes.forEach(cube => {
        const tempCube = cube.clone();
        tempRotGroup.add(tempCube);
        tempGroup.updateMatrixWorld(true);
        const worldPos = new THREE.Vector3();
        tempCube.getWorldPosition(worldPos);
        
        const px = Math.round(worldPos.x);
        const py = Math.round(worldPos.y);
        const pz = Math.round(worldPos.z);

        // 床・壁の判定（はみ出さないように）
        if (py < 0 || px < 0 || px >= GRID_SIZE || pz < 0 || pz >= GRID_SIZE) {
            hasCollision = true;
        }

        // 他の固定ブロックとの重なり判定
        landedBlocksGroup.children.forEach(landed => {
            if (Math.round(landed.position.x) === px && 
                Math.round(landed.position.y) === py && 
                Math.round(landed.position.z) === pz) {
                hasCollision = true;
            }
        });
    });
    return hasCollision;
}

function tryMoveBlock(dx, dy, dz) {
    if (isGameOver) return;
    const tx = translationGroup.position.x + dx;
    const ty = translationGroup.position.y + dy;
    const tz = translationGroup.position.z + dz;

    if (!checkCollision(tx, ty, tz)) {
        translationGroup.position.set(tx, ty, tz);
    } else if (dy < 0) {
        // 下に移動しようとしてぶつかった場合は固定
        lockBlock();
    }
}

function lockBlock() {
    const cubes = [...blockGroup.children];
    cubes.forEach(cube => {
        const worldPos = new THREE.Vector3();
        cube.getWorldPosition(worldPos);
        const newCube = cube.clone();
        newCube.position.copy(worldPos).round();
        landedBlocksGroup.add(newCube);
    });
    
    spawnBlock();
}

// 指定したマスの高さを取得する便利関数
function getHeightAt(x, z) {
    let max = 0;
    landedBlocksGroup.children.forEach(b => {
        if (Math.round(b.position.x) === x && Math.round(b.position.z) === z) {
            max = Math.max(max, Math.round(b.position.y) + 1);
        }
    });
    return max;
}

// キャラクターが階段を登るロジック
function updateCharacter() {
    // ターゲット（ブロックの真下）のX/Zを取得
    const targetX = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(translationGroup.position.x)));
    const targetZ = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(translationGroup.position.z)));

    // キャラクターの現在の高さ
    charHeight = getHeightAt(charGridPos.x, charGridPos.z);
    
    // 目標に向けて1歩ずつ移動を試みる
    if (charGridPos.x !== targetX) {
        const nextX = charGridPos.x + Math.sign(targetX - charGridPos.x);
        const nextHeight = getHeightAt(nextX, charGridPos.z);
        // 高さの差が1マス以下なら移動可能
        if (nextHeight - charHeight <= 1) {
            charGridPos.x = nextX;
        }
    }
    
    charHeight = getHeightAt(charGridPos.x, charGridPos.z);

    if (charGridPos.z !== targetZ) {
        const nextZ = charGridPos.z + Math.sign(targetZ - charGridPos.z);
        const nextHeight = getHeightAt(charGridPos.x, nextZ);
        if (nextHeight - charHeight <= 1) {
            charGridPos.z = nextZ;
        }
    }

    // 最終的な高さを更新
    charHeight = getHeightAt(charGridPos.x, charGridPos.z);

    // キャラクターの見た目を滑らかに移動させる
    characterGroup.position.x += (charGridPos.x - characterGroup.position.x) * 0.2;
    characterGroup.position.z += (charGridPos.z - characterGroup.position.z) * 0.2;
    characterGroup.position.y += (charHeight - characterGroup.position.y) * 0.2;

    document.getElementById('score-display').innerText = `到達高度: ${charHeight}m`;
}

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isGameOver) {
        // 重力落下
        dropTimer += deltaTime;
        if (dropTimer > dropInterval) {
            dropTimer = 0;
            tryMoveBlock(0, -1, 0); 
        }

        // スティック連続移動
        if (activeDir) {
            moveTimer += deltaTime;
            if (moveTimer > moveInterval) {
                moveTimer = 0;
                if (activeDir === 'up') tryMoveBlock(0, 0, -1);
                if (activeDir === 'down') tryMoveBlock(0, 0, 1);
                if (activeDir === 'left') tryMoveBlock(-1, 0, 0);
                if (activeDir === 'right') tryMoveBlock(1, 0, 0);
            }
        }

        updateCharacter();
        
        // 背景色とカメラ追従（キャラクターの高さに合わせる）
        const skyColor = new THREE.Color(0x87CEEB);
        const spaceColor = new THREE.Color(0x000011);
        const progress = Math.min(charHeight / 50, 1.0);
        const currentColor = skyColor.clone().lerp(spaceColor, progress);
        scene.background = currentColor;
        scene.fog.color = currentColor;

        const targetCamY = Math.max(0, charHeight);
        const diffY = (targetCamY - controls.target.y) * 0.05;
        controls.target.y += diffY;
        camera.position.y += diffY; 
    }

    controls.update();
    renderer.render(scene, camera);
}

function setupUI() {
    // --- ジョイスティック処理（前回の修正版と同じ）---
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    let isDraggingJoystick = false;
    let joystickCenter = { x: 0, y: 0 };
    const maxRadius = 35; 

    joystickBase.addEventListener('pointerdown', (e) => {
        isDraggingJoystick = true;
        joystickKnob.style.transition = 'none'; 
        const rect = joystickBase.getBoundingClientRect();
        joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        handleJoystickMove(e);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDraggingJoystick) return;
        handleJoystickMove(e);
    });

    window.addEventListener('pointerup', () => {
        if (!isDraggingJoystick) return;
        isDraggingJoystick = false;
        joystickKnob.style.transition = 'transform 0.1s ease-out';
        joystickKnob.style.transform = `translate(0px, 0px)`;
        activeDir = null;
    });

    function handleJoystickMove(e) {
        const dx = e.clientX - joystickCenter.x;
        const dy = e.clientY - joystickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const visualDist = Math.min(distance, maxRadius);
        const knobX = Math.cos(angle) * visualDist;
        const knobY = Math.sin(angle) * visualDist;
        joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

        if (distance > 15) {
            const deg = angle * (180 / Math.PI);
            if (deg > -45 && deg <= 45) activeDir = 'right';
            else if (deg > 45 && deg <= 135) activeDir = 'down';
            else if (deg > -135 && deg <= -45) activeDir = 'up';
            else activeDir = 'left';
        } else {
            activeDir = null;
        }
    }

    // --- 回転ボタン ---
    document.getElementById('btn-rot-x').addEventListener('pointerdown', () => { 
        if(!isGameOver) { rotationGroup.rotation.x += Math.PI/2; tryMoveBlock(0,0,0); } 
    });
    document.getElementById('btn-rot-y').addEventListener('pointerdown', () => { 
        if(!isGameOver) { rotationGroup.rotation.y += Math.PI/2; tryMoveBlock(0,0,0); }
    });
    document.getElementById('btn-rot-z').addEventListener('pointerdown', () => { 
        if(!isGameOver) { rotationGroup.rotation.z += Math.PI/2; tryMoveBlock(0,0,0); }
    });

    document.getElementById('retry-btn').addEventListener('click', startGame);
}

init();