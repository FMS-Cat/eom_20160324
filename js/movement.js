Movement = ( function() {

  let Movement = class {

    constructor( _params ) {

      let it = this;

    	it.position = 0.0;
      it.velocity = 0.0;
      it.target = 0.0;
      it.frameRate = 50.0;
      it.mode = Movement.STOP;
      it.expOmega = 1.0;
      it.springConstant = 100.0;
      it.springRatio = 1.0;
      it.gravity = 1.0;
      it.gravityBound = 0.5;

    	if ( _params ) {
    		it.set( _params )
    	}

    }

    set( _params ) {

      let it = this;

    	for ( let key in _params ) {
    		it[ key ] = _params[ key ];
    	}

    }

    update() {

      let it = this;

    	if ( it.mode === Movement.STOP ) {
    		it.velocity = 0.0;
    		return;
      } else if ( it.mode === Movement.LINEAR ) {
    		if ( ( 0 < ( it.target - it.position ) ) === ( it.velocity < 0 ) ) {
    			it.position = it.target;
    			it.velocity = 0.0;
    		}
      } else if ( it.mode === Movement.EXP ) {
    		it.velocity = ( it.target - it.position ) * ( 1.0 - Math.exp( -it.expOmega / it.frameRate ) ) * it.frameRate;
    	} else if ( it.mode === Movement.SPRING ) {
    		it.velocity = it.velocity + ( -it.springConstant * ( it.position - it.target ) - 2.0 * it.velocity * Math.sqrt( it.springConstant ) * it.springRatio ) / it.frameRate;
    	} else if ( it.mode === Movement.GRAVITY ) {
    		if (
    			( 0 < ( it.target - it.position ) ) === ( it.gravity < 0 )
    		) {
    			it.position = it.target;
    			it.velocity = -it.velocity * it.gravityBound;
    		}
    		it.velocity = it.velocity + it.gravity / it.frameRate;
    	}

    	it.position = it.position + it.velocity / it.frameRate;

    }

  };

  Movement.STOP = 0;
  Movement.LINEAR = 1;
  Movement.EXP = 2;
  Movement.SPRING = 3;
  Movement.GRAVITY = 4;

  return Movement;

} )();
