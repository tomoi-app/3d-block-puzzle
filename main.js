// js/main.js
const GRID_SIZE = 12; // フィールドの広さ

let scene, camera, renderer;
let translationGroup, rotationGroup, blockGroup, landedBlocksGroup;
let lastTime = 0;
let dropTimer = 0;
const dropInterval = 800; // ブロックが落ちる間隔(ミリ秒)

// テトリミノの形状定義 (とりあえず基本の4種類)
const SHAPES = [
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:-1,y:1,z:0}], // L字
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:-1,y:0,z:0}, {x:2,y:0,z:0}],  // 直線
    [{x:0,y:0,z:0}, {x:-1,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}],  // T字
    [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}, {x:1,y:1,z:0}]   // 四角
];

function init() {
    const container = document.getElementById('game-container');
    scene = new THREE.Scene();
    
    // カメラ設定
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(GRID_SIZE/2, 15, GRID_SIZE + 5);
    camera.lookAt(GRID_SIZE/2, 0, GRID_SIZE/2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 照明
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // 床のガイドグリッド
    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x000000, 0x000000);
    gridHelper.position.set(GRID_SIZE/2 - 0.5, 0, GRID_SIZE/2 - 0.5);
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // グループ構築
    translationGroup = new THREE.Group();
    rotationGroup = new THREE.Group();
    blockGroup = new THREE.Group();
    landedBlocksGroup = new THREE.Group();

    translationGroup.add(rotationGroup);
    rotationGroup.add(blockGroup);
    scene.add(translationGroup);
    scene.add(landedBlocksGroup);

    setupUI();
    spawnBlock(); // 最初のブロックを生成

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    requestAnimationFrame(animate);
}

function spawnBlock() {
    // 古いブロックを削除
    while(blockGroup.children.length > 0){ blockGroup.remove(blockGroup.children[0]); }
    rotationGroup.rotation.set(0, 0, 0); // 回転リセット
    
    // ランダムな形状と色を選択
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.6);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const geometry = new THREE.BoxGeometry(1, 1, 1);

    // ブロックを組み立てる
    shape.forEach(pos => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y, pos.z);
        blockGroup.add(mesh);
    });

    // 上空に配置
    translationGroup.position.set(Math.floor(GRID_SIZE/2), 15, Math.floor(GRID_SIZE/2));
}

function moveBlock(dx, dy, dz) {
    translationGroup.position.x += dx;
    translationGroup.position.y += dy;
    translationGroup.position.z += dz;
    
    // 【簡易版】壁と床の衝突判定
    if (translationGroup.position.y < 0.5 || 
        translationGroup.position.x < 0 || translationGroup.position.x >= GRID_SIZE ||
        translationGroup.position.z < 0 || translationGroup.position.z >= GRID_SIZE) {
        
        // ぶつかったら座標を戻す
        translationGroup.position.x -= dx;
        translationGroup.position.y -= dy;
        translationGroup.position.z -= dz;
        
        // 下方向に移動しようとしてぶつかった（＝着地した）場合
        if (dy < 0) lockBlock();
    }
}

function lockBlock() {
    // 落下中のブロックを「固定ブロックグループ」にコピーして移す
    const cubes = [...blockGroup.children];
    cubes.forEach(cube => {
        const worldPos = new THREE.Vector3();
        cube.getWorldPosition(worldPos);
        
        const newCube = cube.clone();
        newCube.position.copy(worldPos);
        newCube.position.round(); // 座標を整数に丸めてカチッとはめる
        landedBlocksGroup.add(newCube);
    });
    
    // 次のブロックを生成
    spawnBlock();
}

function animate(time) {
    requestAnimationFrame(animate);
    const deltaTime = time - lastTime;
    lastTime = time;

    // ゲームループ: 一定間隔で下に1マス移動
    dropTimer += deltaTime;
    if (dropTimer > dropInterval) {
        dropTimer = 0;
        moveBlock(0, -1, 0); 
    }

    // カメラの自動追従ロジック
    let maxY = 0;
    landedBlocksGroup.children.forEach(c => {
        if(c.position.y > maxY) maxY = c.position.y;
    });
    // 一番高いブロックに合わせてカメラの目標高度を計算し、滑らかに移動
    const targetCamY = Math.max(15, maxY + 15);
    camera.position.y += (targetCamY - camera.position.y) * 0.05;
    camera.lookAt(GRID_SIZE/2, maxY, GRID_SIZE/2);

    renderer.render(scene, camera);
}

function setupUI() {
    // 確実な回転操作（アニメーションなしの即時反映版）
    document.getElementById('btn-rot-x').addEventListener('click', () => { rotationGroup.rotation.x += Math.PI/2; });
    document.getElementById('btn-rot-y').addEventListener('click', () => { rotationGroup.rotation.y += Math.PI/2; });
    document.getElementById('btn-rot-z').addEventListener('click', () => { rotationGroup.rotation.z += Math.PI/2; });
}

// アプリ起動
init();