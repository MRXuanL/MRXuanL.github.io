export 
const STANDNAME=['E4','B3','G3','D3','A2','E2']
const STANDPOS=[4,11,7,2,9,4]
const STANDPITCH=[4,3,3,3,2,2]
const NAMEDIR=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
export function fret2note(string,pos){
  let num=parseInt((STANDPOS[string]+pos)/12);
  let name=(STANDPOS[string]+pos)%12;
  let newPitch=STANDPITCH[string]+num;
  return NAMEDIR[name]+String(newPitch);
}
