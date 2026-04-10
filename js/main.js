// js/main.js
const GRID_SIZE = 12;

let scene, camera, renderer, controls;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let characterGroup, characterArrow;
let armGroup; // 動的に伸縮する「有機的な腕」のグループ
let dropMarkerGroup; // 落下形状マーカーグループ
let directionArrow; // 向き矢印
let lastTime = 0, dropTimer = 0;
const dropInterval = 2000; // 落下速度

// ゲーム状態
let isGameOver = false;
let charGridPos = { x: 5, z: 5 };
let charHeight = 0;
let charFacing = { x: 0, z: -1 }; // 最初は北向き

// HP
let hp = 5;
let prevCharHeight = 0;

// ジョイスティック用
let activeDir = null;
let moveTimer = 0;
const moveInterval = 150;

// カメラのデフォルト設定
const DEFAULT_CAM = { x: GRID_SIZE / 2, y: 25, z: GRID_SIZE + 15 };
const DEFAULT_TARGET = { x: GRID_SIZE / 2, y: 0, z: GRID_SIZE / 2 };

// ダブルタップ検出
let lastTapTime = 0;

const SHAPES = [
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: -1, y: 1, z: 0 }], // L
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],  // I
    [{ x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],  // T
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }],   // O
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],   // S
    [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],   // Z
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],  // J
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }],   // 縦L
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }], // 凸3D
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }],   // 斜め3D
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }], // 十字縦
];

function init() {
    const container = document.getElementById('game-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 60);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000);
    gridHelper.position.set(GRID_SIZE / 2 - 0.5, 0, GRID_SIZE / 2 - 0.5);
    scene.add(gridHelper);

    dropMarkerGroup = new THREE.Group();
    scene.add(dropMarkerGroup);

    directionArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0.1, 0),
        1.4, 0x00ff88, 0.5, 0.3
    );
    scene.add(directionArrow);

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

    renderer.domElement.addEventListener('pointerdown', (e) => {
        const now = Date.now();
        if (now - lastTapTime < 300) resetCamera();
        lastTapTime = now;
    });

    requestAnimationFrame(animate);
}

function resetCamera() {
    const baseY = Math.max(0, charHeight);
    camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y + baseY, DEFAULT_CAM.z);
    controls.target.set(DEFAULT_TARGET.x, baseY, DEFAULT_TARGET.z);
    controls.update();
}

function initCharacter() {
    characterGroup = new THREE.Group();

    // ===== 3Dモデル（.glb）の読み込み =====
    const loader = new THREE.GLTFLoader();

    // ご自身で作ったモデルのパスに合わせてください
    loader.load('./ghost.glb', function (gltf) {
        const model = gltf.scene;

        model.scale.set(1.0, 1.0, 1.0);
        model.position.y = 0.5; // モデルの基準点に応じて調整

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        characterGroup.add(model);
    }, undefined, function (error) {
        console.error('3Dモデルの読み込みに失敗しました:', error);
        // エラー時の仮モデル（赤い箱）
        const fallbackGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
        const fallbackMat = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
        fallbackMesh.position.y = 0.5;
        characterGroup.add(fallbackMesh);
    });

    const arrowGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0xff5500 });
    characterArrow = new THREE.Mesh(arrowGeo, arrowMat);
    characterArrow.position.set(0, 0.06, -0.52);
    characterArrow.rotation.x = Math.PI / 2;
    characterGroup.add(characterArrow);

    characterGroup.position.set(charGridPos.x, 0, charGridPos.z);
    scene.add(characterGroup);

    // ===== 有機的な腕のグループ =====
    armGroup = new THREE.Group();
    scene.add(armGroup);
}

function updateHPDisplay() {
    const hpDiv = document.getElementById('hp-display');
    if (!hpDiv) return;
    hpDiv.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const heart = document.createElement('span');
        if (i < hp) {
            heart.textContent = '\u2665';
            heart.style.color = '#ff2222';
            heart.style.textShadow = '0 0 8px #ff6666, 0 0 18px #ff0000';
        } else {
            heart.textContent = '\u2661';
            heart.style.color = 'rgba(255,255,255,0.3)';
            heart.style.textShadow = 'none';
        }
        heart.style.fontSize = '28px';
        hpDiv.appendChild(heart);
    }
}

function startGame() {
    isGameOver = false;
    hp = 5;
    charGridPos = { x: 5, z: 5 };
    charHeight = 0;
    prevCharHeight = 0;
    charFacing = { x: 0, z: -1 };

    characterGroup.position.set(charGridPos.x, 0, charGridPos.z);

    while (landedBlocksGroup.children.length > 0) landedBlocksGroup.remove(landedBlocksGroup.children[0]);
    document.getElementById('game-over-screen').style.display = 'none';
    updateHPDisplay();
    spawnBlock();
}

function spawnBlock() {
    while (blockGroup.children.length > 0) blockGroup.remove(blockGroup.children[0]);
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

    const front = getDropFront();
    const spawnY = Math.max(charHeight + 8, 12) + 0.5;
    translationGroup.position.set(front.x, spawnY, front.z);
}

function getDropFront() {
    const fx = charGridPos.x + charFacing.x;
    const fz = charGridPos.z + charFacing.z;
    const cx = Math.max(0, Math.min(GRID_SIZE - 1, fx));
    const cz = Math.max(0, Math.min(GRID_SIZE - 1, fz));
    if (cx === charGridPos.x && cz === charGridPos.z) {
        const candidates = [
            { x: charGridPos.x + 1, z: charGridPos.z },
            { x: charGridPos.x - 1, z: charGridPos.z },
            { x: charGridPos.x, z: charGridPos.z + 1 },
            { x: charGridPos.x, z: charGridPos.z - 1 },
        ].filter(p => p.x >= 0 && p.x < GRID_SIZE && p.z >= 0 && p.z < GRID_SIZE);
        return candidates[0] ?? { x: charGridPos.x, z: charGridPos.z };
    }
    return { x: cx, z: cz };
}

function moveForward() {
    if (isGameOver) return;
    const nx = charGridPos.x + charFacing.x;
    const nz = charGridPos.z + charFacing.z;
    if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) return;
    if (getHeightAt(nx, nz) - charHeight > 1) return;
    charGridPos.x = nx;
    charGridPos.z = nz;
}

function moveBackward() {
    if (isGameOver) return;
    const nx = charGridPos.x - charFacing.x;
    const nz = charGridPos.z - charFacing.z;
    if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) return;
    if (getHeightAt(nx, nz) - charHeight > 1) return;
    charGridPos.x = nx;
    charGridPos.z = nz;
}

function turnLeft() {
    if (isGameOver) return;
    charFacing = { x: charFacing.z, z: -charFacing.x };
}

function turnRight() {
    if (isGameOver) return;
    charFacing = { x: -charFacing.z, z: charFacing.x };
}

function checkCollision(targetX, targetY, targetZ) {
    let hasCollision = false;
    const cubes = blockGroup.children;

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

        if (worldPos.y < 0.5 || px < 0 || px >= GRID_SIZE || pz < 0 || pz >= GRID_SIZE) {
            hasCollision = true;
        }

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
        lockBlock();
    }
}

function lockBlock() {
    const cubes = [...blockGroup.children];
    cubes.forEach(cube => {
        const worldPos = new THREE.Vector3();
        cube.getWorldPosition(worldPos);
        const wx = Math.round(worldPos.x);
        const wz = Math.round(worldPos.z);
        if (wx === charGridPos.x && wz === charGridPos.z) return;
        const newCube = cube.clone();
        newCube.position.set(wx, Math.round(worldPos.y * 2) / 2, wz);
        landedBlocksGroup.add(newCube);
    });

    checkFallDamage();
    spawnBlock();
}

function getHeightAt(x, z) {
    let max = 0;
    landedBlocksGroup.children.forEach(b => {
        if (Math.round(b.position.x) === x && Math.round(b.position.z) === z) {
            max = Math.max(max, b.position.y + 0.5);
        }
    });
    return max;
}

function checkFallDamage() {
    const newHeight = getHeightAt(charGridPos.x, charGridPos.z);
    const fall = prevCharHeight - newHeight;
    if (fall >= 4) {
        const dmg = fall - 3;
        hp = Math.max(0, hp - dmg);
        updateHPDisplay();
        showDamageEffect();
        if (hp <= 0) triggerGameOver();
    }
    prevCharHeight = newHeight;
}

function showDamageEffect() {
    const el = document.getElementById('damage-flash');
    if (!el) return;
    el.style.opacity = '0.5';
    setTimeout(() => { el.style.opacity = '0'; }, 300);
}

function triggerGameOver() {
    isGameOver = true;
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = `最高到達高度: ${charHeight}m`;
}

function updateCharacter() {
    if (directionArrow) {
        const dir = new THREE.Vector3(charFacing.x, 0, charFacing.z).normalize();
        directionArrow.setDirection(dir);
        directionArrow.position.set(charGridPos.x, charHeight + 0.1, charGridPos.z);
    }

    const angle = Math.atan2(charFacing.x, charFacing.z);
    characterGroup.rotation.y = angle;

    charHeight = getHeightAt(charGridPos.x, charGridPos.z);

    characterGroup.position.x += (charGridPos.x - characterGroup.position.x) * 0.2;
    characterGroup.position.z += (charGridPos.z - characterGroup.position.z) * 0.2;
    characterGroup.position.y += (charHeight - characterGroup.position.y) * 0.2;

    document.getElementById('score-display').innerText = `到達高度: ${charHeight}m`;

    updateArms();
}

// ===== 有機的な腕の更新関数 =====
function updateArms() {
    if (!armGroup) return;

    // 毎フレーム古い腕を破棄して描き直す
    while (armGroup.children.length > 0) {
        const child = armGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        armGroup.remove(child);
    }

    const charWX = characterGroup.position.x;
    const charWY = characterGroup.position.y;
    const charWZ = characterGroup.position.z;
    const shoulderY = charWY + 1.2;  // 肩の高さ
    const shoulderOffset = 0.45;     // 肩幅

    const perpX = charFacing.z * shoulderOffset;
    const perpZ = -charFacing.x * shoulderOffset;

    const lShoulder = new THREE.Vector3(charWX - perpX, shoulderY, charWZ - perpZ);
    const rShoulder = new THREE.Vector3(charWX + perpX, shoulderY, charWZ + perpZ);

    const blockPos = new THREE.Vector3(
        translationGroup.position.x,
        translationGroup.position.y - 0.4,
        translationGroup.position.z
    );

    // ブロックの左右に手を添える
    const lHand = blockPos.clone().add(new THREE.Vector3(-perpX * 0.7, 0, -perpZ * 0.7));
    const rHand = blockPos.clone().add(new THREE.Vector3(perpX * 0.7, 0, perpZ * 0.7));

    function drawOrganicArm(start, end) {
        // 中間地点を下げて、たるみ（重力感）を表現
        const midPoint = new THREE.Vector3(
            (start.x + end.x) / 2,
            Math.min(start.y, end.y) - 0.6,
            (start.z + end.z) / 2
        );

        // ベジェ曲線
        const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
        const tubeGeo = new THREE.TubeGeometry(curve, 10, 0.08, 6, false);
        const armMat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // ゴーストと同じ色
        const armMesh = new THREE.Mesh(tubeGeo, armMat);
        armGroup.add(armMesh);

        // 先端の丸い手
        const handGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const handMesh = new THREE.Mesh(handGeo, armMat);
        handMesh.position.copy(end);
        armGroup.add(handMesh);
    }

    drawOrganicArm(lShoulder, lHand);
    drawOrganicArm(rShoulder, rHand);
}

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isGameOver) {
        const front = getDropFront();
        translationGroup.position.x = front.x;
        translationGroup.position.z = front.z;

        dropTimer += deltaTime;
        if (dropTimer > dropInterval) {
            dropTimer = 0;
            tryMoveBlock(0, -1, 0);
        }

        if (dropMarkerGroup) {
            while (dropMarkerGroup.children.length > 0) dropMarkerGroup.remove(dropMarkerGroup.children[0]);

            const tmpT = new THREE.Group();
            tmpT.position.set(front.x, translationGroup.position.y, front.z);
            const tmpR = new THREE.Group();
            tmpR.rotation.copy(rotationGroup.rotation);
            tmpT.add(tmpR);
            blockGroup.children.forEach(cube => {
                const tmpC = new THREE.Object3D();
                tmpC.position.copy(cube.position);
                tmpR.add(tmpC);
            });
            tmpT.updateMatrixWorld(true);

            const seen = new Set();
            const markerMat = new THREE.MeshBasicMaterial({
                color: 0xffff00, transparent: true, opacity: 0.45,
                depthWrite: false, side: THREE.DoubleSide
            });
            blockGroup.children.forEach((cube, i) => {
                const wp = new THREE.Vector3();
                tmpR.children[i].getWorldPosition(wp);
                const mx = Math.round(wp.x);
                const mz = Math.round(wp.z);
                const key = `${mx},${mz}`;
                if (seen.has(key)) return;
                seen.add(key);

                let landY = 0;
                landedBlocksGroup.children.forEach(b => {
                    if (Math.round(b.position.x) === mx && Math.round(b.position.z) === mz) {
                        landY = Math.max(landY, b.position.y + 0.5);
                    }
                });

                const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), markerMat);
                plane.rotation.x = -Math.PI / 2;
                plane.position.set(mx, landY + 0.01, mz);
                dropMarkerGroup.add(plane);
            });
        }

        updateCharacter();

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

function hardDrop() {
    if (isGameOver) return;
    let dropped = false;
    for (let i = 0; i < 60; i++) {
        const tx = translationGroup.position.x;
        const ty = translationGroup.position.y - 1;
        const tz = translationGroup.position.z;
        if (!checkCollision(tx, ty, tz)) {
            translationGroup.position.y = ty;
            dropped = true;
        } else {
            lockBlock();
            break;
        }
    }
}

function setupUI() {
    function addMoveBtn(id, action) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let holdTimer = null;
        btn.addEventListener('pointerdown', () => {
            action();
            holdTimer = setInterval(action, moveInterval);
        });
        btn.addEventListener('pointerup', () => clearInterval(holdTimer));
        btn.addEventListener('pointerleave', () => clearInterval(holdTimer));
        btn.addEventListener('pointercancel', () => clearInterval(holdTimer));
    }

    addMoveBtn('btn-fwd', moveForward);
    addMoveBtn('btn-bwd', moveBackward);
    addMoveBtn('btn-turn-l', turnLeft);
    addMoveBtn('btn-turn-r', turnRight);

    document.getElementById('btn-drop').addEventListener('pointerdown', hardDrop);

    document.getElementById('btn-rot-x').addEventListener('pointerdown', () => {
        if (!isGameOver) { rotationGroup.rotation.x += Math.PI / 2; tryMoveBlock(0, 0, 0); }
    });
    document.getElementById('btn-rot-y').addEventListener('pointerdown', () => {
        if (!isGameOver) { rotationGroup.rotation.y += Math.PI / 2; tryMoveBlock(0, 0, 0); }
    });
    document.getElementById('btn-rot-z').addEventListener('pointerdown', () => {
        if (!isGameOver) { rotationGroup.rotation.z += Math.PI / 2; tryMoveBlock(0, 0, 0); }
    });

    document.getElementById('retry-btn').addEventListener('click', startGame);
}

init();