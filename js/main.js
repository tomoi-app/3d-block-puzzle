// js/main.js
const GRID_SIZE = 8;

let scene, camera, renderer, controls;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let characterGroup, characterArrow;
let armGroup;
let dropMarkerGroup;
let lastTime = 0, dropTimer = 0;
const dropInterval = 2000;

let isGameOver = false;
let charGridPos = { x: 4, z: 4 };
let charHeight = 0;
let charFacing = { x: 0, z: -1 };

const moveInterval = 150;

// カメラを8x8グリッドに合わせて少し近くに調整
const DEFAULT_CAM = { x: GRID_SIZE / 2, y: 12, z: GRID_SIZE + 6 };
const DEFAULT_TARGET = { x: GRID_SIZE / 2, y: 0, z: GRID_SIZE / 2 };

let lastTapTime = 0;

const SHAPES = [
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: -1, y: 1, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }],
    [{ x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 0, y: 1, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }],
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }],
];

// ===== ゴースト生成（2Dイラスト風デザイン） =====
function createGhostMesh() {
    const ghostGroup = new THREE.Group();

    const ghostMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
    const darkMat  = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // --- 胴体 ---
    const bodyGeo = new THREE.SphereGeometry(0.5, 64, 64);
    const bPos = bodyGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
        const x = bPos.getX(i);
        const y = bPos.getY(i);
        const z = bPos.getZ(i);
        if (y >= 0) {
            bPos.setY(i, y * 1.6);
        } else {
            const t = Math.abs(y) / 0.5;
            const flare = 1.0 + t * 0.9;
            bPos.setX(i, x * flare);
            bPos.setZ(i, z * flare);
            bPos.setY(i, y * 0.55);
        }
    }
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, ghostMat);
    body.position.y = 0.65;
    ghostGroup.add(body);

    const outlineBody = new THREE.Mesh(bodyGeo, outlineMat);
    outlineBody.position.y = 0.65;
    outlineBody.scale.set(1.05, 1.05, 1.05);
    ghostGroup.add(outlineBody);

    // --- 目 ---
    const eyeBaseGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.04, 16, 16);
    
    const leftEye = new THREE.Mesh(eyeBaseGeo, ghostMat);
    leftEye.position.set(-0.16, 0.82, 0.43);
    const leftEyeOutline = new THREE.Mesh(eyeBaseGeo, outlineMat);
    leftEyeOutline.scale.set(1.15, 1.15, 1.15);
    leftEye.add(leftEyeOutline);
    const leftPupil = new THREE.Mesh(pupilGeo, darkMat);
    leftPupil.position.set(0.02, 0.0, 0.11);
    leftEye.add(leftPupil);
    ghostGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeBaseGeo, ghostMat);
    rightEye.position.set(0.16, 0.82, 0.43);
    const rightEyeOutline = new THREE.Mesh(eyeBaseGeo, outlineMat);
    rightEyeOutline.scale.set(1.15, 1.15, 1.15);
    rightEye.add(rightEyeOutline);
    const rightPupil = new THREE.Mesh(pupilGeo, darkMat);
    rightPupil.position.set(-0.02, 0.0, 0.11);
    rightEye.add(rightPupil);
    ghostGroup.add(rightEye);

    // --- 口 ---
    const mouthPts = [];
    const segments = 10;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const mx = (t - 0.5) * 0.44;
        const wave = Math.sin(t * Math.PI * 2) * 0.03 - 0.02;
        mouthPts.push(new THREE.Vector3(mx, 0.65 + wave, 0.46));
    }
    const mouthCurve = new THREE.CatmullRomCurve3(mouthPts);
    const mouthGeo = new THREE.TubeGeometry(mouthCurve, 16, 0.022, 6, false);
    ghostGroup.add(new THREE.Mesh(mouthGeo, darkMat));

    // --- 裾のぎざぎざ ---
    const jagCount = 6;
    for (let i = 0; i < jagCount; i++) {
        const angle = (i / jagCount) * Math.PI * 2;
        const r = 0.42;
        const jagGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const jag = new THREE.Mesh(jagGeo, ghostMat);
        jag.position.set(Math.sin(angle) * r, 0.28, Math.cos(angle) * r);
        jag.scale.set(1, 0.7, 1);
        ghostGroup.add(jag);

        const outlineJag = new THREE.Mesh(jagGeo, outlineMat);
        outlineJag.position.copy(jag.position);
        outlineJag.scale.set(1.1, 0.8, 1.1);
        ghostGroup.add(outlineJag);
    }

    return ghostGroup;
}

// ===== 背景の塔（画像）を生成する関数 =====
function createBackgroundTower() {
    const bgGroup = new THREE.Group();
    // グリッド中央（3.5, 0, 3.5）に配置
    bgGroup.position.set(3.5, 0, 3.5);
    scene.add(bgGroup);

    const loader = new THREE.TextureLoader();
    const texSpace = loader.load('宇宙.png');

    const segmentsData = [
        { img: '地面.png',       type: 'all' },
        { img: '大気圏.png',     type: 'single' },
        { img: '月.png',         type: 'single' },
        { img: '金星.png',       type: 'single' },
        { img: '水星.png',       type: 'single' },
        { img: '太陽.png',       type: 'single' },
        { img: '宇宙.png',       type: 'all' },
        { img: 'ゴール惑星.png', type: 'all' }
    ];

    const w = GRID_SIZE;        // 8×8グリッドに合わせた幅
    const h = 30;               // 1セグメントの高さ
    const dist = GRID_SIZE / 2; // グリッド半幅 = 4

    // 底面
    const groundCap = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w),
        new THREE.MeshBasicMaterial({ map: loader.load('地面.png'), side: THREE.DoubleSide })
    );
    groundCap.rotation.x = -Math.PI / 2;
    groundCap.position.y = -0.5;
    bgGroup.add(groundCap);

    segmentsData.forEach((seg, index) => {
        const texMain = loader.load(seg.img);
        const y = index * h + (h / 2);

        for (let i = 0; i < 4; i++) {
            // i=2 はカメラ側（+z方向）→ 非表示
            if (i === 2) continue;

            const isPlanet = (seg.type === 'all') || (i === 0);
            const tex = isPlanet ? texMain : texSpace;
            const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

            // グリッド壁面の位置（dist=4がグリッドの端）
            if (i === 0) { plane.position.set(0, y, -dist); plane.rotation.y = 0; }          // 奥
            if (i === 1) { plane.position.set( dist, y, 0); plane.rotation.y = -Math.PI / 2; } // 右
            if (i === 3) { plane.position.set(-dist, y, 0); plane.rotation.y =  Math.PI / 2; } // 左

            bgGroup.add(plane);
        }
    });

    // 天井
    const topCap = new THREE.Mesh(
        new THREE.PlaneGeometry(w, w),
        new THREE.MeshBasicMaterial({ map: loader.load('ゴール惑星.png'), side: THREE.DoubleSide })
    );
    topCap.rotation.x = Math.PI / 2;
    topCap.position.y = segmentsData.length * h;
    bgGroup.add(topCap);
}


function init() {
    const container = document.getElementById('game-container');
    scene = new THREE.Scene();
    
    // 背景の霧と色を消し、純粋な黒（宇宙の隙間用）にする
    scene.background = new THREE.Color(0x000000);

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 地面（イラスト風のアウトライン付き台座）
    const groundGeo = new THREE.BoxGeometry(GRID_SIZE, 0.4, GRID_SIZE);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(GRID_SIZE / 2 - 0.5, -0.2, GRID_SIZE / 2 - 0.5);
    scene.add(ground);

    const outlineGroundMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
    const outlineGround = new THREE.Mesh(groundGeo, outlineGroundMat);
    outlineGround.scale.set(1.02, 1.05, 1.02);
    ground.add(outlineGround);

    // 真っ黒なグリッド線
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x111111, 0x111111);
    gridHelper.position.set(GRID_SIZE / 2 - 0.5, 0.01, GRID_SIZE / 2 - 0.5);
    scene.add(gridHelper);

    dropMarkerGroup = new THREE.Group();
    scene.add(dropMarkerGroup);

    translationGroup = new THREE.Group();
    rotationGroup = new THREE.Group();
    blockGroup = new THREE.Group();
    landedBlocksGroup = new THREE.Group();

    translationGroup.add(rotationGroup);
    rotationGroup.add(blockGroup);
    scene.add(translationGroup);
    scene.add(landedBlocksGroup);

    initCharacter();
    
    // 背景の塔を生成
    createBackgroundTower();
    
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
    const ghost = createGhostMesh();
    characterGroup.add(ghost);
    characterGroup.position.set(charGridPos.x, 0, charGridPos.z);
    scene.add(characterGroup);

    armGroup = new THREE.Group();
    scene.add(armGroup);
}

function startGame() {
    isGameOver = false;
    charGridPos = { x: 4, z: 4 };
    charHeight = 0;
    charFacing = { x: 0, z: -1 };

    characterGroup.position.set(charGridPos.x, 0, charGridPos.z);

    while (landedBlocksGroup.children.length > 0) landedBlocksGroup.remove(landedBlocksGroup.children[0]);
    document.getElementById('game-over-screen').style.display = 'none';
    spawnBlock();
}

function spawnBlock() {
    while (blockGroup.children.length > 0) blockGroup.remove(blockGroup.children[0]);
    rotationGroup.rotation.set(0, 0, 0);

    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const BLOCK_COLORS = [0x4285F4, 0xEA4335, 0x34A853, 0xFBBC05];
    const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    const material = new THREE.MeshLambertMaterial({ color: color });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });

    const geometry = new THREE.BoxGeometry(1, 1, 1);

    shape.forEach(pos => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y, pos.z);

        const outlineMesh = new THREE.Mesh(geometry, outlineMat);
        outlineMesh.scale.set(1.05, 1.05, 1.05);
        mesh.add(outlineMesh);

        blockGroup.add(mesh);
    });

    const front = getDropFront();
    const spawnY = charHeight + 10;
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
        newCube.position.set(wx, worldPos.y - 0.5, wz);
        landedBlocksGroup.add(newCube);
    });

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

function triggerGameOver() {
    isGameOver = true;
    document.getElementById('game-over-screen').style.display = 'flex';
    document.getElementById('final-score').innerText = `最高到達高度: ${charHeight}m`;
}

function updateCharacter() {
    const angle = Math.atan2(charFacing.x, charFacing.z);
    characterGroup.rotation.y = angle;

    charHeight = getHeightAt(charGridPos.x, charGridPos.z);

    characterGroup.position.x += (charGridPos.x - characterGroup.position.x) * 0.2;
    characterGroup.position.z += (charGridPos.z - characterGroup.position.z) * 0.2;
    characterGroup.position.y += (charHeight - characterGroup.position.y) * 0.2;

    updateArms();
}

function updateArms() {
    if (!armGroup) return;

    while (armGroup.children.length > 0) {
        const child = armGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        armGroup.remove(child);
    }

    const charWX = characterGroup.position.x;
    const charWY = characterGroup.position.y;
    const charWZ = characterGroup.position.z;

    const shoulderY = charWY + 1.1;
    const shoulderOffset = 0.38;

    const perpX = charFacing.z * shoulderOffset;
    const perpZ = -charFacing.x * shoulderOffset;

    const lShoulder = new THREE.Vector3(charWX - perpX, shoulderY, charWZ - perpZ);
    const rShoulder = new THREE.Vector3(charWX + perpX, shoulderY, charWZ + perpZ);

    const blockPos = new THREE.Vector3(
        translationGroup.position.x,
        translationGroup.position.y - 0.4,
        translationGroup.position.z
    );

    const lHand = blockPos.clone().add(new THREE.Vector3(-perpX * 0.8, 0, -perpZ * 0.8));
    const rHand = blockPos.clone().add(new THREE.Vector3(perpX * 0.8, 0, perpZ * 0.8));

    const armMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });

    function drawArm(start, end) {
        const dist = start.distanceTo(end);
        const sag = Math.min(dist * 0.4, 3.0);
        const mid = new THREE.Vector3(
            (start.x + end.x) / 2,
            Math.min(start.y, end.y) - sag,
            (start.z + end.z) / 2
        );

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const segments = 16;
        const points = curve.getPoints(segments);

        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const radius = 0.08 * (1 - t * 0.2);
            const segCurve = new THREE.LineCurve3(points[i], points[i + 1]);
            const geo = new THREE.TubeGeometry(segCurve, 1, radius, 7, false);
            armGroup.add(new THREE.Mesh(geo, armMat));
        }

        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), armMat);
        hand.position.copy(end);
        armGroup.add(hand);

        for (let f = 0; f < 3; f++) {
            const fAngle = (f / 3) * Math.PI * 1.2 - Math.PI * 0.3;
            const fDir = new THREE.Vector3(Math.sin(fAngle) * 0.12, 0.08, Math.cos(fAngle) * 0.12);
            const finger = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), armMat);
            finger.position.copy(end).add(fDir);
            armGroup.add(finger);
        }
    }

    drawArm(lShoulder, lHand);
    drawArm(rShoulder, rHand);
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
                color: 0xaaaaaa, 
                transparent: true, opacity: 0.5,
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
    for (let i = 0; i < 60; i++) {
        const tx = translationGroup.position.x;
        const ty = translationGroup.position.y - 1;
        const tz = translationGroup.position.z;
        if (!checkCollision(tx, ty, tz)) {
            translationGroup.position.y = ty;
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