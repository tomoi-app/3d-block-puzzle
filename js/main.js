const GRID_SIZE = 12;

let scene, camera, renderer;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let characterGroup, characterArm;
let lastTime = 0, dropTimer = 0;
const dropInterval = 800; 

// ゲーム状態
let isGameOver = false;
let currentScore = 0;

// ジョイスティック（連続移動）用
let activeDir = null;
let moveTimer = 0;
const moveInterval = 150; // 連続移動のスピード

// テトリミノ定義
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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 土台グリッド
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000);
    gridHelper.position.set(GRID_SIZE/2 - 0.5, 0, GRID_SIZE/2 - 0.5);
    scene.add(gridHelper);

    // グループ作成
    translationGroup = new THREE.Group();
    rotationGroup = new THREE.Group();
    blockGroup = new THREE.Group();
    landedBlocksGroup = new THREE.Group();

    translationGroup.add(rotationGroup);
    rotationGroup.add(blockGroup);
    scene.add(translationGroup);
    scene.add(landedBlocksGroup);

    // キャラクター（プレースホルダー）の作成
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
    
    // 体（白い円柱）
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16);
    const bodyMat = new THREE.MeshLambertMaterial({color: 0xffffff});
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5; // 足元を基準にするため上にずらす
    characterGroup.add(body);

    // 伸びる腕（細い円柱）
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    // 腕の起点を端にするためジオメトリをずらす
    armGeo.translate(0, 0.5, 0); 
    const armMat = new THREE.MeshLambertMaterial({color: 0xffffff});
    characterArm = new THREE.Mesh(armGeo, armMat);
    characterGroup.add(characterArm);

    scene.add(characterGroup);
}

function startGame() {
    isGameOver = false;
    currentScore = 0;
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

    translationGroup.position.set(Math.floor(GRID_SIZE/2), Math.max(15, currentScore + 10), Math.floor(GRID_SIZE/2));
}

function moveBlock(dx, dy, dz) {
    if (isGameOver) return;
    
    translationGroup.position.x += dx;
    translationGroup.position.y += dy;
    translationGroup.position.z += dz;
    
    // 【場外落下判定】XとZが土台(0〜11)から外れたら許可するが、固定時に落ちる
    let hitFloorOrBlock = false;

    // 着地判定（Yが0以下、または他のブロックに触れたら）
    if (translationGroup.position.y < 0.5) hitFloorOrBlock = true;
    
    // ※今回は簡易的に、Yだけ戻して着地させる
    if (hitFloorOrBlock && dy < 0) {
        translationGroup.position.y -= dy; // 沈み込みを防ぐ
        lockBlock();
    }
}

function lockBlock() {
    const px = Math.round(translationGroup.position.x);
    const pz = Math.round(translationGroup.position.z);

    // 【ゲームオーバー判定】土台からはみ出して固定しようとしたら落下！
    if (px < 0 || px >= GRID_SIZE || pz < 0 || pz >= GRID_SIZE) {
        triggerGameOver();
        return;
    }

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

function triggerGameOver() {
    isGameOver = true;
    document.getElementById('final-score').innerText = `最終高度: ${currentScore}m`;
    document.getElementById('game-over-screen').style.display = 'flex';
}

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    if (isGameOver) {
        // 落下アニメーション
        translationGroup.position.y -= 0.5;
        characterGroup.position.y -= 0.5;
    } else {
        // 重力落下
        dropTimer += deltaTime;
        if (dropTimer > dropInterval) {
            dropTimer = 0;
            moveBlock(0, -1, 0); 
        }

        // スティック連続移動
        if (activeDir) {
            moveTimer += deltaTime;
            if (moveTimer > moveInterval) {
                moveTimer = 0;
                if (activeDir === 'up') moveBlock(0, 0, -1);
                if (activeDir === 'down') moveBlock(0, 0, 1);
                if (activeDir === 'left') moveBlock(-1, 0, 0);
                if (activeDir === 'right') moveBlock(1, 0, 0);
            }
        }

        updateCharacterAndCamera();
    }

    renderer.render(scene, camera);
}

function updateCharacterAndCamera() {
    // 1. 最高高度の計算とスコア更新
    let maxY = 0;
    landedBlocksGroup.children.forEach(c => {
        if(c.position.y > maxY) maxY = c.position.y;
    });
    currentScore = Math.floor(maxY);
    document.getElementById('score-display').innerText = `高度: ${currentScore}m`;

    // 2. キャラクターの足場を計算
    const px = Math.round(translationGroup.position.x);
    const pz = Math.round(translationGroup.position.z);
    let groundY = 0;
    landedBlocksGroup.children.forEach(b => {
        if (Math.round(b.position.x) === px && Math.round(b.position.z) === pz) {
            groundY = Math.max(groundY, b.position.y + 0.5); 
        }
    });

    // キャラの位置を更新
    characterGroup.position.set(px, groundY, pz);

    // 3. 腕をブロックまで伸ばす
    // 体のてっぺん(Y+1) から ブロックの下部(translation.y) へ
    const shoulderPos = new THREE.Vector3(px, groundY + 1.0, pz);
    const blockPos = translationGroup.position.clone();
    
    const distance = shoulderPos.distanceTo(blockPos);
    characterArm.position.copy(shoulderPos); // 肩を起点にする
    characterArm.scale.set(1, distance, 1);  // 距離分だけ伸ばす
    characterArm.lookAt(blockPos);           // ブロックの方向を向く
    characterArm.rotateX(Math.PI / 2);       // 円柱の向きを補正

    // 4. 背景色とカメラ追従
    const skyColor = new THREE.Color(0x87CEEB);
    const spaceColor = new THREE.Color(0x000011);
    const progress = Math.min(currentScore / 50, 1.0);
    const currentColor = skyColor.clone().lerp(spaceColor, progress);
    scene.background = currentColor;
    scene.fog.color = currentColor;

    const targetCamY = Math.max(15, maxY + 15);
    camera.position.y += (targetCamY - camera.position.y) * 0.05;
    camera.lookAt(GRID_SIZE/2, maxY, GRID_SIZE/2);
}

function setupUI() {
    // --- ジョイスティックの本格的なドラッグ処理 ---
    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');
    let isDraggingJoystick = false;
    let joystickCenter = { x: 0, y: 0 };
    const maxRadius = 35; // ノブが動ける最大距離

    joystickBase.addEventListener('pointerdown', (e) => {
        isDraggingJoystick = true;
        joystickKnob.style.transition = 'none'; // ドラッグ中はアニメーションを切る
        
        // ジョイスティックの中心座標を取得
        const rect = joystickBase.getBoundingClientRect();
        joystickCenter = { 
            x: rect.left + rect.width / 2, 
            y: rect.top + rect.height / 2 
        };
        handleJoystickMove(e);
    });

    // 画面のどこに指が動いても追従する
    window.addEventListener('pointermove', (e) => {
        if (!isDraggingJoystick) return;
        handleJoystickMove(e);
    });

    // 指を離した時のリセット処理
    window.addEventListener('pointerup', () => {
        if (!isDraggingJoystick) return;
        isDraggingJoystick = false;
        joystickKnob.style.transition = 'transform 0.1s ease-out';
        joystickKnob.style.transform = `translate(0px, 0px)`; // 中央に戻す
        activeDir = null; // 移動ストップ
    });

    function handleJoystickMove(e) {
        // 中心からの距離と角度を計算
        const dx = e.clientX - joystickCenter.x;
        const dy = e.clientY - joystickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        // ノブの見た目を動かす（はみ出さないように制限）
        const visualDist = Math.min(distance, maxRadius);
        const knobX = Math.cos(angle) * visualDist;
        const knobY = Math.sin(angle) * visualDist;
        joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

        // 一定以上倒したら、方向（activeDir）を決定してブロックを動かす
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

    // --- 回転ボタンの処理 ---
    document.getElementById('btn-rot-x').addEventListener('pointerdown', () => { if(!isGameOver) rotationGroup.rotation.x += Math.PI/2; });
    document.getElementById('btn-rot-y').addEventListener('pointerdown', () => { if(!isGameOver) rotationGroup.rotation.y += Math.PI/2; });
    document.getElementById('btn-rot-z').addEventListener('pointerdown', () => { if(!isGameOver) rotationGroup.rotation.z += Math.PI/2; });

    // --- リトライボタン ---
    document.getElementById('retry-btn').addEventListener('click', startGame);
}

init();
