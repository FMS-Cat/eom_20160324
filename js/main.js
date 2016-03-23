( function() {

  'use strict';

  let requestText = function( _url, _callback ){
    let xhr = new XMLHttpRequest();
    xhr.open( 'GET', _url, true );
    xhr.responseType = 'text';
    xhr.onload = function( _e ){
      if( typeof _callback === 'function' ){
        _callback( this.response );
      }
    };
    xhr.send();
  };

  let step = function( _array ){
    let array = _array;
    let count = 0;

    let func = function(){
      if( typeof _array[ count ] === 'function' ){
        _array[ count ]( func );
      }
      count ++;
    };
    func();
  };

  // ------

  let clamp = function( _value, _min, _max ) {
    return Math.min( Math.max( _value, _min ), _max );
  }

  let saturate = function( _value ) {
    return clamp( _value, 0.0, 1.0 );
  }

  let merge = function( _a, _b ) {
    let ret = {};
    for ( let key in _a ) {
      ret[ key ] = _a[ key ];
    }
    for ( let key in _b ) {
      ret[ key ] = _b[ key ];
    }
    return ret;
  }

  // ------

  let gl = canvas.getContext( 'webgl' );
  let glCat = new GLCat( gl );

  let programs = {};
  let quadVBO = glCat.createVertexbuffer( [ -1, -1, 1, -1, -1, 1, 1, 1 ] );
  let quadVert = 'attribute vec2 p; void main() { gl_Position = vec4( p, 0.0, 1.0 ); }';

  let distanceSize = 2048;
  let wordTexture = glCat.createTexture();

  let wordCanvas = document.createElement( 'canvas' );
  wordCanvas.width = distanceSize;
  wordCanvas.height = distanceSize;
  let wordContext = wordCanvas.getContext( '2d' );

  let framebuffers = {};
  framebuffers.distance = glCat.createFramebuffer( distanceSize, distanceSize );
  framebuffers.render = glCat.createFloatFramebuffer( canvas.width, canvas.height );
  framebuffers.blur = glCat.createFloatFramebuffer( canvas.width, canvas.height );
  framebuffers.return = glCat.createFloatFramebuffer( canvas.width, canvas.height );

  let renderA = document.createElement( 'a' );

  // ------

  let movementInit = {
    mode: Movement.SPRING,
    springConstant: 300.0,
    springRatio: 1.0,
    frameRate: 50.0
  };
  let movementInitCamera = merge(
    movementInit,
    { springConstant: 300.0 }
  );
  let movements = {};

  movements.cameraPosX = new Movement( movementInitCamera );
  movements.cameraPosY = new Movement( movementInitCamera );
  movements.cameraPosZ = new Movement( movementInitCamera );

  // ------

  let time = 0;
  let frame = 0;
  let blurCount = 0;

  let timeline = {
    0.00: function() {
      movements.cameraPosX.set( { target: -0.0 } );
      movements.cameraPosY.set( { target: -0.0 } );
      movements.cameraPosZ.set( { target: 2.0 } );
    },
    0.50: function() {
      movements.cameraPosX.set( { target: -0.6 } );
      movements.cameraPosY.set( { target: 0.6 } );
      movements.cameraPosZ.set( { target: 1.6 } );
    },
    0.75: function() {
      movements.cameraPosX.set( { target: 0.8 } );
      movements.cameraPosY.set( { target: -0.4 } );
      movements.cameraPosZ.set( { target: 1.8 } );
    },
  };

  let timelineProgress = -1.0;
  let executeTimeline = function() {
    for ( let keyTime in timeline ) {
      if ( keyTime < time ) {
        if ( timelineProgress < keyTime ) {
          timelineProgress = keyTime;
          timeline[ keyTime ]();
          break;
        }
      } else {
        break;
      }
    }
  }

  let movement = function() {

    executeTimeline();

    for ( let key in movements ) {
      movements[ key ].frameRate = 50.0 * ( blurCheckbox.checked ? 10.0 : 1.0 );
      movements[ key ].update();
    }

  }

  // ------

  let createDistance = function( _str ) {

    wordContext.fillStyle = '#000';
    wordContext.fillRect( 0, 0, distanceSize, distanceSize );

    wordContext.fillStyle = '#fff';
    wordContext.font = '900 ' + distanceSize * 0.1 + 'px Helvetica Neue';
    wordContext.textAlign = 'center';
    wordContext.textBaseline = 'middle';
    wordContext.fillText( _str, distanceSize / 2, distanceSize / 2 );

    // ------

    glCat.setTexture( wordTexture, wordCanvas );
    let framebuffer = glCat.createFramebuffer( distanceSize, distanceSize );

    // ------

    gl.viewport( 0, 0, distanceSize, distanceSize );
    glCat.useProgram( programs.distance );
    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffers.distance );
    glCat.clear();

    glCat.attribute( 'p', quadVBO, 2 );
    glCat.uniform1i( 'isVert', 0 );
    glCat.uniform1f( 'distSize', distanceSize );
    glCat.uniformTexture( 'texture', wordTexture, 0 );

    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    // ------

    gl.viewport( 0, 0, distanceSize, distanceSize );
    glCat.useProgram( programs.distance );
    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffer );
    glCat.clear();

    glCat.attribute( 'p', quadVBO, 2 );
    glCat.uniform1i( 'isVert', 1 );
    glCat.uniform1f( 'distSize', distanceSize );
    glCat.uniformTexture( 'texture', framebuffers.distance.texture, 0 );

    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    // ------

    gl.flush();

    return framebuffer;

  };

  xorshift( 123456 );

  let wordTextures;
  let prepareDistance = function() {

    wordTextures = [];
    for ( let i = 0; i < 8; i ++ ) {
      let str = '';
      for ( let iChar = 0; iChar < 4; iChar ++ ) {
        str += String.fromCharCode( Math.floor( Math.pow( xorshift(), 9.0 ) * 256.0 ) * 256.0 + xorshift() * 256.0 );
      }
      wordTextures.push( createDistance( str ).texture );
    }

  }

  // ------

  let raymarch = function( _iBlur ) {

    gl.viewport( 0, 0, canvas.width, canvas.height );
    glCat.useProgram( programs.raymarch );
    gl.bindFramebuffer( gl.FRAMEBUFFER, blurCheckbox.checked ? framebuffers.render : null );
    glCat.clear();

    glCat.attribute( 'p', quadVBO, 2 );
    glCat.uniform1f( 'time', time + _iBlur / 160.0 / 10.0 );
    glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );
    glCat.uniform3fv( 'u_cameraPos', [
      movements.cameraPosX.position,
      movements.cameraPosY.position,
      movements.cameraPosZ.position
    ] );
    glCat.uniformTexture( 'textureWord2', wordTextures[ ( function() {
      return ( Math.floor( time * 4.0 + 0.5 ) * 2.0 ) % 8.0;
    } )() ], 0 );
    glCat.uniformTexture( 'textureWord1', wordTextures[ ( function() {
      return Math.floor( time * 4.0 ) * 2.0 + 1.0;
    } )() ], 1 );

    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

  };

  let blur = function() {

    gl.viewport( 0, 0, canvas.width, canvas.height );
    glCat.useProgram( programs.blur );
    gl.bindFramebuffer( gl.FRAMEBUFFER, framebuffers.return );
    glCat.clear();

    glCat.attribute( 'p', quadVBO, 2 );
    glCat.uniform1f( 'add', 0.1 );
    glCat.uniform1i( 'init', blurCount === 0 );
    glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );
    glCat.uniformTexture( 'renderTexture', framebuffers.render.texture, 0 );
    glCat.uniformTexture( 'blurTexture', framebuffers.blur.texture, 1 );

    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    // ------

    gl.viewport( 0, 0, canvas.width, canvas.height );
    glCat.useProgram( programs.return );
    gl.bindFramebuffer( gl.FRAMEBUFFER, blurCount === 9 ? null : framebuffers.blur );
    glCat.clear();

    glCat.attribute( 'p', quadVBO, 2 );
    glCat.uniform2fv( 'resolution', [ canvas.width, canvas.height ] );
    glCat.uniformTexture( 'texture', framebuffers.return.texture, 0 );

    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

  }

  let render = function() {
    if ( blurCheckbox.checked ) {
      for ( let iBlur = 0; iBlur < 10; iBlur ++ ) {
        blurCount = iBlur;
        movement();
        raymarch( iBlur );
        blur();
      }
    } else {
      movement();
      raymarch( 0 );
    }
    gl.flush();
  }

  let saveFrame = function() {
    renderA.href = canvas.toDataURL();
    renderA.download = ( '0000' + frame ).slice( -5 ) + '.png';
    renderA.click();
  };

  let update = function() {

    let frames = 160;
    if ( ( frame % frames ) === 0 ) {
      timelineProgress = -1.0;
    }
    time = ( frame % frames ) / frames;

    render();

    if ( saveCheckbox.checked && frames <= frame ) {
      saveFrame();
    }

    frame ++;
    requestAnimationFrame( update );

  };

  goButton.onclick = function() {
    prepareDistance();
    update();
  };

  // ------

  step( {

    0: function( _step ) {
      requestText( 'shader/raymarch.frag', function( _frag ) {
        programs.raymarch = glCat.createProgram( quadVert, _frag );
        _step();
      } );
      requestText( 'shader/blur.frag', function( _frag ) {
        programs.blur = glCat.createProgram( quadVert, _frag );
        _step();
      } );
      requestText( 'shader/return.frag', function( _frag ) {
        programs.return = glCat.createProgram( quadVert, _frag );
        _step();
      } );
      requestText( 'shader/distance.frag', function( _frag ) {
        programs.distance = glCat.createProgram( quadVert, _frag );
        _step();
      } );
    },

    4: function( _step ) {
      goButton.style.display = 'inline';
    }

  } );



} )();
