// js/main.js
const GRID_SIZE = 12;

let scene, camera, renderer, controls;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let characterGroup, characterArrow;
let armLeft, armRight;       // 動的に伸縮する腕
let dropMarkerGroup; // 落下形状マーカーグループ
let directionArrow; // 向き矢印
let lastTime = 0, dropTimer = 0;
const dropInterval = 2000; // 落下速度（遅め）

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
const DEFAULT_CAM = { x: GRID_SIZE/2, y: 25, z: GRID_SIZE + 15 };
const DEFAULT_TARGET = { x: GRID_SIZE/2, y: 0, z: GRID_SIZE/2 };

// ダブルタップ検出
let lastTapTime = 0;

const SHAPES = [
    // 既存
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:-1,y:1,z:0}], // L
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:2,y:0,z:0}],  // I
    [{x:0,y:0,z:0}, {x:-1,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}],  // T
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}, {x:1,y:1,z:0}],   // O
    // 新規追加
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:1,y:1,z:0}, {x:2,y:1,z:0}],   // S
    [{x:0,y:1,z:0}, {x:1,y:1,z:0}, {x:1,y:0,z:0}, {x:2,y:0,z:0}],   // Z
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:1,y:1,z:0}],  // J
    [{x:0,y:0,z:0}, {x:0,y:1,z:0}, {x:0,y:2,z:0}, {x:1,y:2,z:0}],   // 縦L
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:0,z:1}, {x:1,y:0,z:1}, {x:0,y:1,z:0}], // 凸3D
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:0,z:1}, {x:1,y:1,z:1}],   // 斜め3D
    [{x:0,y:0,z:0}, {x:0,y:1,z:0}, {x:0,y:2,z:0}, {x:0,y:0,z:1}, {x:0,y:0,z:-1}], // 十字縦
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
    gridHelper.position.set(GRID_SIZE/2 - 0.5, 0, GRID_SIZE/2 - 0.5);
    scene.add(gridHelper);

    // 落下形状マーカーグループ（毎フレーム再構築）
    dropMarkerGroup = new THREE.Group();
    scene.add(dropMarkerGroup);

    // 向き矢印（ArrowHelper）
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

    // ダブルタップで視点リセット
    renderer.domElement.addEventListener('pointerdown', (e) => {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            resetCamera();
        }
        lastTapTime = now;
    });

    requestAnimationFrame(animate);
}

function resetCamera() {
    // 現在のcharHeightに合わせてリセット
    const baseY = Math.max(0, charHeight);
    camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y + baseY, DEFAULT_CAM.z);
    controls.target.set(DEFAULT_TARGET.x, baseY, DEFAULT_TARGET.z);
    controls.update();
}

function initCharacter() {
    characterGroup = new THREE.Group();

    // ===== 画像をスプライト（ビルボード）として表示 =====
    // Canvas経由で白背景を透明に変換してからテクスチャ化
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, img.width, img.height);
        const d  = id.data;
        for (let i = 0; i < d.length; i += 4) {
            // 白(R>210, G>210, B>210)を透明に
            if (d[i] > 210 && d[i+1] > 210 && d[i+2] > 210) d[i+3] = 0;
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(spriteMat);
        // 画像は正方形(512x512)なので縦横比を保って2マス分の高さ
        sprite.scale.set(1.8, 1.8, 1);
        sprite.position.y = 0.9; // 地面から上に
        characterGroup.add(sprite);
    };
    img.src = './無題6_20260409214610.PNG';

    // ===== 向き矢印（足元の小さいコーン） =====
    const arrowGeo = new THREE.ConeGeometry(0.1, 0.3, 4);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0xff5500 });
    characterArrow = new THREE.Mesh(arrowGeo, arrowMat);
    characterArrow.position.set(0, 0.06, -0.52);
    characterArrow.rotation.x = Math.PI / 2;
    characterGroup.add(characterArrow);

    characterGroup.position.set(charGridPos.x, 0, charGridPos.z);
    scene.add(characterGroup);

    // ===== 動的な腕（ワールド空間） =====
    // updateArms()で毎フレーム肩→ブロック底面まで伸縮させる
    const armMat = new THREE.MeshLambertMaterial({ color: 0xe0dfff });
    const armGeo = new THREE.CylinderGeometry(0.055, 0.072, 1, 6);
    armLeft  = new THREE.Mesh(armGeo, armMat);
    armRight = new THREE.Mesh(armGeo, armMat);
    scene.add(armLeft);
    scene.add(armRight);
}

function updateHPDisplay() {
    const hpDiv = document.getElementById('hp-display');
    if (!hpDiv) return;
    hpDiv.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const heart = document.createElement('span');
        if (i < hp) {
            heart.textContent = '\u2665'; // 塗りつぶしハート
            heart.style.color = '#ff2222';
            heart.style.textShadow = '0 0 8px #ff6666, 0 0 18px #ff0000';
        } else {
            heart.textContent = '\u2661'; // 空白ハート
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

    // キャラクターを初期位置に戻す
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

    // キャラの1マス前から落とす（0.5オフセットで地面に接地）
    const front = getDropFront();
    const spawnY = Math.max(charHeight + 8, 12) + 0.5; // 半ステップオフセット
    translationGroup.position.set(front.x, spawnY, front.z);
}

// キャラの1マス前の着地予定地を返す（絶対にキャラ位置と重ならない）
function getDropFront() {
    const fx = charGridPos.x + charFacing.x;
    const fz = charGridPos.z + charFacing.z;
    const cx = Math.max(0, Math.min(GRID_SIZE - 1, fx));
    const cz = Math.max(0, Math.min(GRID_SIZE - 1, fz));
    // クランプ後もキャラと同じなら別の隣接セルを探す
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
    // 1マス以上の段差は登れない
    if (getHeightAt(nx, nz) - charHeight > 1) return;
    charGridPos.x = nx;
    charGridPos.z = nz;
}

function moveBackward() {
    if (isGameOver) return;
    const nx = charGridPos.x - charFacing.x;
    const nz = charGridPos.z - charFacing.z;
    if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) return;
    // 1マス以上の段差は登れない
    if (getHeightAt(nx, nz) - charHeight > 1) return;
    charGridPos.x = nx;
    charGridPos.z = nz;
}

function turnLeft() {
    if (isGameOver) return;
    // その場で左に向きを変える（移動なし）
    charFacing = { x: charFacing.z, z: -charFacing.x };
}

function turnRight() {
    if (isGameOver) return;
    // その場で右に向きを変える（移動なし）
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
        const py = Math.round(worldPos.y); // ブロック間充突判定用
        const pz = Math.round(worldPos.z);

        // 床判定：ブロック中心が 0.5 未満なら押し返す→地面充突
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
        // キャラの位置には絶対に置かない
        if (wx === charGridPos.x && wz === charGridPos.z) return;
        const newCube = cube.clone();
        // Y座標は 0.5単位グリッドに丸める（底面が地面y=0に接地）
        newCube.position.set(
            wx,
            Math.round(worldPos.y * 2) / 2, // 0.5単位に書ける
            wz
        );
        landedBlocksGroup.add(newCube);
    });

    // ブロック着地後にキャラの高さチェック（落下ダメージ）
    checkFallDamage();

    spawnBlock();
}

function getHeightAt(x, z) {
    // 底面y=0に接地する坐標系：ブロックは y=0.5, 1.5, 2.5...に中心を持つ
    // getHeightAtは「スタックの上面Y」 = 1, 2, 3... を返す
    let max = 0;
    landedBlocksGroup.children.forEach(b => {
        if (Math.round(b.position.x) === x && Math.round(b.position.z) === z) {
            max = Math.max(max, b.position.y + 0.5); // top of block
        }
    });
    return max; // 0=地面, 1=1段, 2=2段...
}

function checkFallDamage() {
    // キャラの足元の高さを再計算
    const newHeight = getHeightAt(charGridPos.x, charGridPos.z);
    const fall = prevCharHeight - newHeight;
    if (fall >= 4) {
        const dmg = fall - 3; // 4マス落下で1ダメージ、5マスで2ダメージ…
        hp = Math.max(0, hp - dmg);
        updateHPDisplay();
        showDamageEffect();
        if (hp <= 0) {
            triggerGameOver();
        }
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
    // 向き矢印を更新
    if (directionArrow) {
        const dir = new THREE.Vector3(charFacing.x, 0, charFacing.z).normalize();
        directionArrow.setDirection(dir);
        directionArrow.position.set(
            charGridPos.x,
            charHeight + 0.1,
            charGridPos.z
        );
    }

    // キャラクターの向きをモデルに反映
    const angle = Math.atan2(charFacing.x, charFacing.z);
    characterGroup.rotation.y = angle;

    // キャラの乗る高さ
    charHeight = getHeightAt(charGridPos.x, charGridPos.z);

    // キャラの外観を滑らかに
    characterGroup.position.x += (charGridPos.x - characterGroup.position.x) * 0.2;
    characterGroup.position.z += (charGridPos.z - characterGroup.position.z) * 0.2;
    characterGroup.position.y += (charHeight - characterGroup.position.y) * 0.2;

    document.getElementById('score-display').innerText = `到達高度: ${charHeight}m`;

    // 腕の伸縮を更新
    updateArms();
}

// 腕：毎フレーム、キャラ肖からブロック底面まで直線を引いてシリンダーを伸縮
function updateArms() {
    if (!armLeft || !armRight) return;

    // キャラの肖（データ・ワールド座標）
    const charWX = characterGroup.position.x;
    const charWY = characterGroup.position.y;
    const charWZ = characterGroup.position.z;
    const shoulderY = charWY + 1.55; // 肖の高さ
    const shoulderOffset = 0.38;     // 左右の肖幅

    // 向きに合わせた肖の左右X・Zオフセット（キャラが向いている方向に垂直）
    const perpX = charFacing.z * shoulderOffset;  // 向きに垂直の横方向
    const perpZ = -charFacing.x * shoulderOffset;

    const lShoulder = new THREE.Vector3(charWX - perpX, shoulderY, charWZ - perpZ);
    const rShoulder = new THREE.Vector3(charWX + perpX, shoulderY, charWZ + perpZ);

    // ブロックの底面（ブロックのXZ = キャラの1マス前）
    const blockPos = new THREE.Vector3(
        translationGroup.position.x,
        translationGroup.position.y - 0.5, // ブロック底面
        translationGroup.position.z
    );

    // 肖からブロック底面までの方向ベクトルを計算し、シリンダーを配置
    function positionArm(arm, shoulder) {
        const dir = new THREE.Vector3().subVectors(blockPos, shoulder);
        const len = Math.max(0.05, dir.length());

        arm.scale.y = len; // Y軸方向にスケール

        // シリンダーのY軸をdirに向ける
        const mid = shoulder.clone().add(blockPos).multiplyScalar(0.5);
        arm.position.copy(mid);

        // lookAtを使わず手動で正規化dirから回転計算
        const up = new THREE.Vector3(0, 1, 0);
        const normDir = dir.clone().normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normDir);
        arm.quaternion.copy(quaternion);
    }

    positionArm(armLeft,  lShoulder);
    positionArm(armRight, rShoulder);
}

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    if (!isGameOver) {
        // 「キャラの位置と向き」を先に確定してから落下処理（バグ修正）
        const front = getDropFront();
        translationGroup.position.x = front.x;
        translationGroup.position.z = front.z;

        // 重力落下（上記のXZ確定後に実行するのが重要）
        dropTimer += deltaTime;
        if (dropTimer > dropInterval) {
            dropTimer = 0;
            tryMoveBlock(0, -1, 0);
        }

        // マーカー：ブロックの形料を地面に投影
        if (dropMarkerGroup) {
            // マーカーをリセット
            while (dropMarkerGroup.children.length > 0) dropMarkerGroup.remove(dropMarkerGroup.children[0]);

            // 一時グループで各キューブの世界座標を計算
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

                // このXZ位置の着地予定Yを計算
                let landY = 0;
                landedBlocksGroup.children.forEach(b => {
                    if (Math.round(b.position.x) === mx && Math.round(b.position.z) === mz) {
                        landY = Math.max(landY, b.position.y + 0.5); // top of block
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

// ハードドロップ：即座に着地位置まで鎊め込む
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
            lockBlock(); // 街物にぶつかったら即座に固定
            break;
        }
    }
}

function setupUI() {
    // ボタンを2回手に登録するヘルパー：タップで即時実行、長押しで追後繰り返し
    function addMoveBtn(id, action) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let holdTimer = null;
        btn.addEventListener('pointerdown', () => {
            action(); // たった1回実行
            holdTimer = setInterval(action, moveInterval); // 長押しは自動繰り返し
        });
        btn.addEventListener('pointerup',     () => clearInterval(holdTimer));
        btn.addEventListener('pointerleave',  () => clearInterval(holdTimer));
        btn.addEventListener('pointercancel', () => clearInterval(holdTimer));
    }

    addMoveBtn('btn-fwd',    moveForward);
    addMoveBtn('btn-bwd',    moveBackward);
    addMoveBtn('btn-turn-l', turnLeft);
    addMoveBtn('btn-turn-r', turnRight);

    // 中央ボタン：ハードドロップ（即座着地）
    document.getElementById('btn-drop').addEventListener('pointerdown', hardDrop);

    // 回転ボタン
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