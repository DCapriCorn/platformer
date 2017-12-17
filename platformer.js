(function ($) {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    var player, score, stop, ticker;
    var ground = [], water = [], enemies = [], environment = [];
    var enemyOn = 0;
    var jumpTimes = 0;
    var jumpAchieve = 0;
    var lives = 3;

    var platformHeight, platformLength, gapLength;
    var platformWidth = 32;
    var platformBase = canvas.height - platformWidth;
    var platformSpacer = 64;

    var canUseLocalStorage = 'localStorage' in window && window.localStorage !== null;

    function rand(low, high) {
        return Math.floor(Math.random() * (high - low + 1) + low);
    }

    function bound(num, low, high) {
        return Math.max(Math.min(num, high), low);
    }

    var assetLoader = (function () {
        this.imgs = {
            'bg': 'imgs/bg.png',
            'sky': 'imgs/sky.png',
            'backdrop': 'imgs/backdrop.png',
            'backdrop2': 'imgs/backdrop_ground.png',
            'grass': 'imgs/grass.png',
            'avatar_normal': 'imgs/running.png',
            'water': 'imgs/water.png',
            'grass1': 'imgs/grassMid1.png',
            'grass2': 'imgs/grassMid2.png',
            'bridge': 'imgs/bridge.png',
            'plant': 'imgs/plant.png',
            'bush1': 'imgs/bush1.png',
            'bush2': 'imgs/bush2.png',
            'cliff': 'imgs/grassCliffRight.png',
            'spikes': 'imgs/spikes.png',
            'box': 'imgs/boxCoin.png',
            'slime': 'imgs/enemy.png'
        };

        var assetsLoaded = 0;
        var numImgs = Object.keys(this.imgs).length;
        this.totalAssest = numImgs;

        function assetLoaded(dic, name) {
            if (this[dic][name].status !== 'loading') {
                return;
            }

            this[dic][name].status = 'loaded';
            assetsLoaded++;

            if (typeof this.progress === 'function') {
                this.progress(assetsLoaded, this.totalAssest);
            }

            if (assetsLoaded === this.totalAssest && typeof this.finished === 'function') {
                this.finished();
            }
        }

        this.downloadAll = function () {
            var _this = this;
            var src;

            for (var img in this.imgs) {
                if (this.imgs.hasOwnProperty(img)) {
                    src = this.imgs[img];

                    (function (_this, img) {
                        _this.imgs[img] = new Image();
                        _this.imgs[img].status = 'loading';
                        _this.imgs[img].name = img;
                        _this.imgs[img].onload = function () {
                            assetLoaded.call(_this, 'imgs', img)
                        };
                        _this.imgs[img].src = src;
                    })(_this, img);
                }
            }
        }

        return {
            imgs: this.imgs,
            totalAssest: this.totalAssest,
            downloadAll: this.downloadAll
        };
    })();

    assetLoader.progress = function (progress, total) {
        var pBar = document.getElementById('progress-bar');
        pBar.value = progress / total;
        document.getElementById('p').innerHTML = Math.round(pBar.value * 100) + "%";
    }

    assetLoader.finished = function () {
        mainMenu();
    }

    function SpriteSheet(path, frameWidth, frameHeight) {
        this.image = new Image();
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;

        var self = this;
        this.image.onload = function () {
            self.framesPerRow = Math.floor(self.image.width / self.frameWidth);
        };

        this.image.src = path;
    }

    function Animation(spritesheet, frameSpeed, startFrame, endFrame) {

        var animationSequence = [];
        var currentFrame = 0;
        var counter = 0;

        for (var frameNumber = startFrame; frameNumber <= endFrame; frameNumber++)
            animationSequence.push(frameNumber);
        this.update = function () {

            if (counter == (frameSpeed - 1))
                currentFrame = (currentFrame + 1) % animationSequence.length;

            counter = (counter + 1) % frameSpeed;
        };

        this.draw = function (x, y) {
            var row = Math.floor(animationSequence[currentFrame] / spritesheet.framesPerRow);
            var col = Math.floor(animationSequence[currentFrame] % spritesheet.framesPerRow);

            ctx.drawImage(
                spritesheet.image,
                col * spritesheet.frameWidth, row * spritesheet.frameHeight,
                spritesheet.frameWidth, spritesheet.frameHeight,
                x, y,
                spritesheet.frameWidth, spritesheet.frameHeight);
        };
    }

    var background = (function () {
        var sky = {};
        var backdrop = {};
        var backdrop2 = {};

        this.draw = function () {
            ctx.drawImage(assetLoader.imgs.bg, 0, 0);

            sky.x -= sky.speed;
            backdrop.x -= backdrop.speed;
            backdrop2.x -= backdrop2.speed;

            ctx.drawImage(assetLoader.imgs.sky, sky.x, sky.y);
            ctx.drawImage(assetLoader.imgs.sky, sky.x + canvas.width, sky.y);

            ctx.drawImage(assetLoader.imgs.backdrop, backdrop.x, backdrop.y);
            ctx.drawImage(assetLoader.imgs.backdrop, backdrop.x + canvas.width, backdrop.y);

            ctx.drawImage(assetLoader.imgs.backdrop2, backdrop2.x, backdrop2.y);
            ctx.drawImage(assetLoader.imgs.backdrop2, backdrop2.x + canvas.width, backdrop2.y);

            if (sky.x + assetLoader.imgs.sky.width <= 0)
                sky.x = 0;
            if (backdrop.x + assetLoader.imgs.backdrop.width <= 0)
                backdrop.x = 0;
            if (backdrop2.x + assetLoader.imgs.backdrop2.width <= 0)
                backdrop2.x = 0;
        };

        this.reset = function () {
            sky.x = 0;
            sky.y = 0;
            sky.speed = 0.2;

            backdrop.x = 0;
            backdrop.y = 0;
            backdrop.speed = 0.4;

            backdrop2.x = 0;
            backdrop2.y = 0;
            backdrop2.speed = 0.6;
        }

        return {
            draw: this.draw,
            reset: this.reset
        };
    })();

    function Vector(x, y, dx, dy) {
        this.x = x || 0;
        this.y = y || 0;

        this.dx = dx || 0;
        this.dy = dy || 0;
    }

    Vector.prototype.advance = function () {
        this.x += this.dx;
        this.y += this.dy;
    };

    Vector.prototype.minDist = function (vec) {
        var minDist = Infinity;
        var max = Math.max(Math.abs(this.dx), Math.abs(this.dy),
            Math.abs(vec.dx), Math.abs(vec.dy));
        var slice = 1 / max;

        var x, y, distSquared;

        var vec1 = {}, vec2 = {};
        vec1.x = this.x + this.width / 2;
        vec1.y = this.y + this.height / 2;
        vec2.x = vec.x + vec.width / 2;
        vec2.y = vec.y + vec.height / 2;
        for (var percent = 0; percent < 1; percent += slice) {
            x = (vec1.x + this.dx * percent) - (vec2.x + vec.dx * percent);
            y = (vec1.y + this.dy * percent) - (vec2.y + vec.dy * percent);
            distSquared = x * x + y * y;

            minDist = Math.min(minDist, distSquared);
        }

        return Math.sqrt(minDist);
    };

    var player = (function (player) {
        player.width = 60;
        player.height = 96;
        player.speed = 6;

        player.gravity = 1;
        player.dy = 0;
        player.jumpDy = -10;
        player.isFalling = false;
        player.isJumping = false;

        player.sheet = new SpriteSheet('imgs/running.png', player.width, player.height);
        player.walkAnim = new Animation(player.sheet, 4, 0, 15);
        player.jumpAnim = new Animation(player.sheet, 4, 15, 15);
        player.fallAnim = new Animation(player.sheet, 4, 11, 11);
        player.anim = player.walkAnim;

        Vector.call(player, 0, 0, 0, player.dy);

        var jumpCounter = 0;

        player.update = function () {
            if (KEY_STATUS.space && player.dy === 0 && !player.isJumping) {
                player.isJumping = true;
                player.dy = player.jumpDy;
                jumpCounter = 12;
                jumpTimes++;
            }

            if (KEY_STATUS.space && jumpCounter) {
                player.dy = player.jumpDy;
            }

            jumpCounter = Math.max(jumpCounter - 1, 0);

            this.advance();

            if (player.isFalling || player.isJumping) {
                player.dy += player.gravity;
            }

            if (player.dy > 0) {
                player.anim = player.fallAnim;
            }
            else if (player.dy < 0) {
                player.anim = player.jumpAnim;
            }
            else {
                player.anim = player.walkAnim;
            }

            player.anim.update();
        };

        player.draw = function () {
            player.anim.draw(player.x, player.y);
        };

        player.reset = function () {
            player.x = 64;
            player.y = 250;
        };

        return player;
    })(Object.create(Vector.prototype));

    function Sprite(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = platformWidth;
        this.height = platformWidth;
        this.type = type;
        Vector.call(this, x, y, 0, 0);

        this.update = function () {
            this.dx = -player.speed;
            this.advance();
        };

        this.draw = function () {
            ctx.save();
            ctx.translate(0.5, 0.5);
            ctx.drawImage(assetLoader.imgs[this.type], this.x, this.y);
            ctx.restore();
        };
    }

    Sprite.prototype = Object.create(Vector.prototype);

    function getType() {
        var type;
        switch (platformHeight) {
            case 0:
            case 1:
                type = Math.random() > 0.5 ? 'grass1' : 'grass2';
                break;
            case 2:
                type = 'grass';
                break;
            case 3:
                type = 'bridge';
                break;
            case 4:
                type = 'box';
                break;
        }
        if (platformLength === 1 && platformHeight < 3 && rand(0, 3) === 0) {
            type = 'cliff';
        }

        return type;
    }

    function updateGround() {
        player.isFalling = true;
        for (var i = 0; i < ground.length; i++) {
            ground[i].update();
            ground[i].draw();

            var angle;
            if (player.minDist(ground[i]) <= player.height / 2 + platformWidth / 2 &&
                (angle = Math.atan2(player.y - ground[i].y, player.x - ground[i].x) * 180 / Math.PI) > -130 &&
                angle < -50) {
                player.isJumping = false;
                player.isFalling = false;
                player.y = ground[i].y - player.height + 5;
                player.dy = 0;
            }
        }

        if (ground[0] && ground[0].x < -platformWidth) {
            ground.splice(0, 1);
        }
    }

    function updateWater() {
        for (var i = 0; i < water.length; i++) {
            water[i].update();
            water[i].draw();
        }

        if (water[0] && water[0].x < -platformWidth) {
            var w = water.splice(0, 1)[0];
            w.x = water[water.length - 1].x + platformWidth;
            water.push(w);
        }
    }

    function updateEnvironment() {
        for (var i = 0; i < environment.length; i++) {
            environment[i].update();
            environment[i].draw();
        }

        if (environment[0] && environment[0].x < -platformWidth) {
            environment.splice(0, 1);
        }
    }

    function updateEnemies() {
        for (var i = 0; i < enemies.length; i++) {
            enemies[i].update();
            enemies[i].draw();

            if (player.minDist(enemies[i]) <= player.width - platformWidth / 2) {
                if (lives > 0) {
                    continueGame();
                } else {
                    gameOver();
                }
            }
        }

        if (enemies[0] && enemies[0].x < -platformWidth) {
            enemies.splice(0, 1);
        }
    }

    function updatePlayer() {
        player.update();
        player.draw();

        if (player.y + player.height >= canvas.height) {
            if (lives > 0) {
                continueGame();
            } else {
                gameOver();
            }
        }
    }

    function spawnSprites() {
        score++;
        switch (score) {
            case 1000:
                $('#1-score').text($('#1-score').text() + 'Done');
                break;
            case 2000:
                $('#2-score').text($('#2-score').text() + 'Done');
                break;
            case 3000:
                $('#3-score').text($('#3-score').text() + 'Done');
                break;
        }
        if (jumpTimes === 10 && jumpAchieve === 0) {
            jumpAchieve = 1;
            $('#jump-100').text($('#jump-100').text() + 'Done');
        }
        if (gapLength > 0) {
            gapLength--;
        }
        else if (platformLength > 0) {
            var type = getType();

            ground.push(new Sprite(
                canvas.width + platformWidth % player.speed,
                platformBase - platformHeight * platformSpacer,
                type
            ));
            platformLength--;

            spawnEnvironmentSprites();

            if (enemyOn === 1) {
                spawnEnemySprites();
            }
        }
        else {
            gapLength = rand(player.speed - 2, player.speed);
            platformHeight = bound(rand(0, platformHeight + rand(0, 2)), 0, 4);
            platformLength = rand(Math.floor(player.speed / 2), player.speed * 4);
        }
    }

    function spawnEnvironmentSprites() {
        if (score > 40 && rand(0, 20) === 0 && platformHeight < 3) {
            if (Math.random() > 0.5) {
                environment.push(new Sprite(
                    canvas.width + platformWidth % player.speed,
                    platformBase - platformHeight * platformSpacer - platformWidth,
                    'plant'
                ));
            }
            else if (platformLength > 2) {
                environment.push(new Sprite(
                    canvas.width + platformWidth % player.speed,
                    platformBase - platformHeight * platformSpacer - platformWidth,
                    'bush1'
                ));
                environment.push(new Sprite(
                    canvas.width + platformWidth % player.speed + platformWidth,
                    platformBase - platformHeight * platformSpacer - platformWidth,
                    'bush2'
                ));
            }
        }
    }

    function spawnEnemySprites() {
        if (score > 100 && Math.random() > 0.96 && enemies.length < 3 && platformLength > 5 &&
            (enemies.length ? canvas.width - enemies[enemies.length - 1].x >= platformWidth * 3 ||
                canvas.width - enemies[enemies.length - 1].x < platformWidth : true)) {
            enemies.push(new Sprite(
                canvas.width + platformWidth % player.speed,
                platformBase - platformHeight * platformSpacer - platformWidth,
                Math.random() > 0.5 ? 'spikes' : 'slime'
            ));
        }
    }

    function animate() {
        if (!stop) {
            requestAnimFrame(animate);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            background.draw();

            updateWater();
            updateEnvironment();
            updatePlayer();
            updateGround();
            if (enemyOn) {
                updateEnemies();
            }

            ctx.fillText('Score: ' + score + 'm', canvas.width - 140, 30);
            if (ticker % Math.floor(platformWidth / player.speed) === 0) {
                spawnSprites();
            }

            if (ticker > (Math.floor(platformWidth / player.speed) * player.speed * 20) && player.dy !== 0) {
                player.speed = bound(++player.speed, 0, 15);
                player.walkAnim.frameSpeed = Math.floor(platformWidth / player.speed) - 1;

                ticker = 0;

                if (gapLength === 0) {
                    var type = getType();
                    ground.push(new Sprite(
                        canvas.width + platformWidth % player.speed,
                        platformBase - platformHeight * platformSpacer,
                        type
                    ));
                    platformLength--;
                }
            }

            ticker++;
        }
    }

    var KEY_CODES = {
        32: 'space'
    };
    var KEY_STATUS = {};
    for (var code in KEY_CODES) {
        if (KEY_CODES.hasOwnProperty(code)) {
            KEY_STATUS[KEY_CODES[code]] = false;
        }
    }
    document.onkeydown = function (e) {
        var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
        if (KEY_CODES[keyCode]) {
            e.preventDefault();
            KEY_STATUS[KEY_CODES[keyCode]] = true;
        }
    };
    document.onkeyup = function (e) {
        var keyCode = (e.keyCode) ? e.keyCode : e.charCode;
        if (KEY_CODES[keyCode]) {
            e.preventDefault();
            KEY_STATUS[KEY_CODES[keyCode]] = false;
        }
    };

    var requestAnimFrame = (function () {
        return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback, element) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    function mainMenu() {
        $('#progress').hide();
        $('#main').show();
        $('#menu').addClass('main');
    }

    function startGame(continueGame) {
        if (continueGame === undefined) {
            continueGame = false;
        }
        document.getElementById('game-over').style.display = 'none';
        document.getElementById('continue-game').style.display = 'none';

        ground = [];
        water = [];
        environment = [];
        enemies = [];
        player.reset();
        ticker = 0;
        stop = false;
        if (!continueGame) {
            background.reset();
            player.speed = 6;
            score = 0;
        }
        platformHeight = 2;
        platformLength = 15;
        gapLength = 0;
        jumpTimes = 0;

        ctx.font = '16px arial, sans-serif';

        for (var i = 0; i < 30; i++) {
            ground.push(new Sprite(i * (platformWidth - 3), platformBase - platformHeight * platformSpacer, 'grass'));
        }

        for (i = 0; i < canvas.width / 32 + 2; i++) {
            water.push(new Sprite(i * platformWidth, platformBase, 'water'));
        }

        background.reset();

        animate();
    }

    function gameOver() {
        stop = true;
        $('#score').html(score);
        $('#game-over').show();
    }

    function continueGame() {
        stop = true;
        $('#score-continue').html(score);
        $('#continue-game').show();
    }

    $('.enemy').click(function () {
        if ($(this).data('enemy') == 0) {
            $(this).text('Enemy: Yes');
            $(this).data('enemy', 1);
            enemyOn = 1;
        } else {
            $(this).text('Enemy: No');
            $(this).data('enemy', 0);
            enemyOn = 0;
        }
    });
    $('.back').click(function () {
        $('#credits').hide();
        $('#main').show();
        $('#menu').removeClass('credits');
    });
    $('.play').click(function () {
        $('#menu').hide();
        startGame();
    });
    $('.restart').click(function () {
        lives = 3;
        $('#lives').text('Lives: ' + lives);
        $('#game-over').hide();
        startGame();
    });
    $('.continue').click(function () {
        $('#game-over').hide();
        lives--;
        $('#lives').text('Lives: ' + lives);
        startGame(true);
    });
    assetLoader.downloadAll();
})(jQuery);