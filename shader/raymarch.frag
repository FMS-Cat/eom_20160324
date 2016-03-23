#define MARCH_ITER 64
#define RAYAMP_LIMIT 0.05

// ------

#define PI 3.14159265
#define V vec2(0.,1.)
#define saturate(i) clamp(i,0.,1.)

// ------

precision mediump float;

uniform float time;
uniform vec2 resolution;

uniform vec3 u_cameraPos;

uniform sampler2D textureWord1;
uniform sampler2D textureWord2;

// ------

mat2 rotate2D( float _t ) {
  return mat2( cos( _t ), sin( _t ), -sin( _t ), cos( _t ) );
}

vec3 rotateEuler( vec3 _p, vec3 _r ) {
  vec3 p = _p;
  p.yz = rotate2D( _r.x ) * p.yz;
  p.zx = rotate2D( _r.y ) * p.zx;
  p.xy = rotate2D( _r.z ) * p.xy;
  return p;
}

// ------

struct Camera {
  vec3 pos;
  vec3 dir;
  vec3 sid;
  vec3 top;
};

struct Map {
  float dist;
  bool alt;
};

struct Ray {
  vec3 dir;
  vec3 ori;
  float len;
  vec3 pos;
  bool inside;
  Map map;
  vec3 colDec;
  vec3 colAmp;
};

// ------

vec2 p;

Camera cam;
Ray ray;

// ------

float box( vec3 _pos, vec3 _size ) {
  vec3 dist = abs( _pos ) - _size;
  return min( max( dist.x, max( dist.y, dist.z ) ), 0.0 ) + length( max( dist, 0.0 ) );
}

float boxCluster( vec3 _p, float _size ) {
  float distBox = 1E9;
  for ( int i = 0; i < 4; i ++ ) {
    float m = ( 0.4 - 0.07 * float( i ) ) * _size;
    vec3 p = mod( _p + float( i ) + time * float( i ) * m * V.xyx, m ) - m / 2.0;
    distBox = min( distBox, box( p, V.yyy * m / 4.0 * vec3( 1.0, 1.0, 4.0 ) ) );
  }
  return distBox;
}

vec3 ifs( vec3 _p, vec3 _rot, vec3 _shift ) {
  vec3 pos = _p;

  vec3 shift = _shift;

  for ( int i = 0; i < 5; i ++ ) {
    float intensity = pow( 2.0, -float( i ) );

    pos.y -= 0.0;

    pos = abs( pos ) - shift * intensity;

    shift.yz = rotate2D( _rot.x ) * shift.yz;
    shift.zx = rotate2D( _rot.y ) * shift.zx;
    shift.xy = rotate2D( _rot.z ) * shift.xy;

    if ( pos.x < pos.y ) { pos.xy = pos.yx; }
    if ( pos.x < pos.z ) { pos.xz = pos.zx; }
    if ( pos.y < pos.z ) { pos.yz = pos.zy; }
  }

  return pos;
}

float word( vec3 _p, sampler2D _tex, float _size, float _ext, float _bold ) {
  vec3 pos = _p;
  if ( box( pos, vec2( 0.5 * _size, _ext * 2.0 ).xxy ) < 0.0 ) {
    vec4 tex = V.xxxx;
    for ( int iy = -1; iy < 2; iy ++ ) {
      for ( int ix = -1; ix < 2; ix ++ ) {
        vec2 coord = 0.5 + pos.xy / _size + vec2( ix, iy ) / 2048.0;
        tex += texture2D( _tex, coord ) / 9.0;
      }
    }
    vec2 distXY = vec2(
      ( ( tex.x - 0.5 ) - _bold ) * _size / 8.0,
      abs( pos.z ) - _ext
    );

    float dist = min( max( distXY.x, distXY.y ), 0.0 ) + length( max( distXY, 0.0 ) );
    return dist;
  } else {
    return box( pos, vec2( 0.5 * _size, _ext * 2.0 ).xxy * 0.9 );
  }
}

float slasher( vec3 _p, float _ratio ) {
  float phase = ( _p.x + _p.y );
  float slash = abs( 0.5 - ( phase - floor( phase ) ) ) * 2.0;
  return ( slash - _ratio ) / sqrt( 3.0 );
}

// ------

Map mapInit( float _dist );
Map distFunc( in vec3 _p ) {
  vec3 p = _p;
  Map map = mapInit( 1E9 );

  float distWord = mix(
    word( p, textureWord1, 8.0, 0.5, 0.0 ),
    word( p, textureWord2, 8.0, 0.5, 0.0 ),
    cos( time * PI * 2.0 * 4.0 ) * 0.5 + 0.5
  );
  if ( distWord < map.dist ) {
    map = mapInit( distWord );
  }

  p = mod( _p - 2.0 - V.yxx * time * 4.0, 4.0 ) - 2.0;
  p = ifs(
    p,
    vec3( 0.04, 0.02, 0.07 ),
    vec3( 3.3, 2.9, 3.8 )
  );
  float distGeo1 = box( p, vec3( 0.1 ) );

  p = _p;
  distGeo1 = max( distGeo1, -box( p, vec3( 1E3, 0.9, 3.9 ) ) );

  p = mod( _p - 1.0 - V.yxx * time * 2.0, 2.0 ) - 1.0;
  p = ifs(
    p,
    vec3( 0.04, 0.02, 0.07 ),
    vec3( 2.6, 3.4, 2.8 )
  );
  float distGeo2 = box( p, vec3( 0.2 ) );

  p = _p;
  distGeo2 = max( distGeo2, -box( p, vec3( 1E3, 1.0, 4.0 ) ) );

  float distGeo = min( distGeo1, distGeo2 );

  if ( distGeo < map.dist ) {
    map = mapInit( distGeo );
    map.alt = true;
  }

  return map;
}

vec3 normalFunc( in vec3 _p, in float _d ) {
  vec2 d = V * _d;
  return normalize( vec3(
    distFunc( _p + d.yxx ).dist - distFunc( _p - d.yxx ).dist,
    distFunc( _p + d.xyx ).dist - distFunc( _p - d.xyx ).dist,
    distFunc( _p + d.xxy ).dist - distFunc( _p - d.xxy ).dist
  ) );
}

// ------

Camera camInit( in vec3 _pos, in vec3 _tar ) {
  Camera cam;
  cam.pos = _pos;
  cam.dir = normalize( _tar - _pos );
  cam.sid = normalize( cross( cam.dir, V.xyx ) );
  cam.top = normalize( cross( cam.sid, cam.dir ) );

  return cam;
}

Map mapInit( in float _dist ) {
  Map map;
  map.dist = _dist;
  map.alt = false;
  return map;
}

Ray rayInit( in vec3 _ori, in vec3 _dir ) {
  Ray ray;
  ray.dir = _dir;
  ray.ori = _ori;
  ray.len = 1E-2;
  ray.pos = ray.ori + ray.dir * ray.len;
  ray.inside = distFunc( ray.ori ).dist < 0.0;
  ray.map = mapInit( 0.0 );
  ray.colDec = V.xxx;
  ray.colAmp = V.yyy;
  return ray;
}

Ray rayFromCam( in vec2 _p, in Camera _cam ) {
  vec3 dir = normalize( _p.x * _cam.sid + _p.y * _cam.top + _cam.dir * ( 1.0 - length( p.xy ) * 0.1 ) );
  return rayInit( _cam.pos, dir );
}

// ------

Ray march( in Ray _ray ) {
  Ray ray = _ray;

  for ( int iMarch = 0; iMarch < MARCH_ITER; iMarch ++ ) {
    ray.pos = ray.ori + ray.dir * ray.len;
    ray.map = distFunc( ray.pos );
    ray.map.dist *= ( ray.inside ? -1.0 : 1.0 ) * 0.8;
    ray.len += ray.map.dist;
    if ( 1E3 < ray.len || ray.map.dist < 1E-4 ) { break; }
  }

  return ray;
}

// ------

Ray shade( in Ray _ray ) {
  Ray ray = _ray;

  float decay = exp( -ray.len * 1E-1 );
  vec3 fogColor = vec3( 0.0 );

  ray.colDec += fogColor * ( 1.0 - decay ) * ray.colAmp;
  ray.colAmp *= decay;

  if ( ray.map.dist < 1E-2 ) {
    vec3 normalL = normalFunc( ray.pos, ray.len * 1E-5 );
    vec3 normalS = normalFunc( ray.pos, ray.len * 1E-2 * ( ray.map.alt ? 1.0 : 2.0 ) );
    float edge = saturate( -0.5 + 2.0 * length( normalL - normalS ) );

    float dif = saturate( -dot( ray.dir, normalL ) );

    ray.colDec += mix(
      ray.map.alt ? V.yyy * 0.3 * dif : V.yyy,
      ray.map.alt ? vec3( 1.9, 0.4, 0.8 ) : V.xxx,
      edge
    ) * ray.colAmp * 0.8;
    ray.colAmp *= 0.2 * ( 1.0 - edge );
    ray.ori = ray.pos;
    ray.dir = reflect( ray.dir, normalL );
  } else {
    ray.colAmp = V.xxx;
  }
  return ray;
}

// ------

void main() {
  p = ( gl_FragCoord.xy * 2.0 - resolution ) / resolution.x;
  //p.x = abs( p.x );

  cam = camInit( u_cameraPos, V.xxx );
  ray = rayFromCam( p, cam );

  for ( int iRef = 0; iRef < 6; iRef ++ ) {
    ray = march( ray );
    ray = shade( ray );
    if ( length( ray.colAmp ) < 0.05 ) { break; }
  }

  gl_FragColor = vec4( ray.colDec - length( p ) * 0.1, 1.0 );
}
