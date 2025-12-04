import * as Vex from "vexflow";
const {StaveNote, TabStave, TabNote, Beam, Formatter, Renderer, Voice } = Vex;
export class Table{
    constructor(num_beats=4,beat_value=4,divid="table",bpm=60,defaultPos=10,defaultWidth=200,defaultRenderWidth=1200){
        this._isInitialized=false;
        this.reset(num_beats,beat_value,divid,bpm,defaultPos,defaultWidth,defaultRenderWidth);
    }
    setBeat(num_beats,beat_value){//设置Beat
        this._num_beats=num_beats;
        this._beat_value=beat_value;
    }
    addMeasure(){//在之前的Measure超过一小节时,需要添加新的Measure
        const length=this._staves.length-1;
        const isfull=Math.abs(this._curTotalTimes[length]-this._num_beats)<0.001;
        if(!isfull){alert("Current measure is not full!");return;}
        const startpos=this._staves[length].width + this._staves[length].x;
        this._staves.push(new TabStave(startpos,0,200));
        this._measures.push([]);
        this._curTotalTimes.push(0);
    }
    addNote(positions,duration){//可以添加单个音符又可以添加和弦
        console.log("addNote",duration);
        let curNoteMeasure=this._measures[this._staves.length-1];
        let curTotalTime=this._curTotalTimes[this._staves.length-1];
        const TotalTime=this.trueDuration(duration)+curTotalTime;
        if(TotalTime<=this._num_beats){
            if(duration[duration.length-1]!='r'){
                if(positions.length==0){
                    return;
                }
                curNoteMeasure.push(new TabNote({positions:positions,duration:duration}));
            }
            else{
                let key="";
                if(duration[0]=='w'){
                    key="d/5";
                }else if(duration[0]=='h'){
                    key="b/4";
                }else if(duration[0]=='q'){
                    key="b/4";
                }else if(duration[0]=='8'){
                    key="c/5";
                }else if(duration[0]=='1'){
                    key="c/5";
                }else if(duration[0]=='3'){
                    key="c/5";
                }else if(duration[0]=='6'){
                    key="d/5";
                }
                curNoteMeasure.push(new StaveNote({keys: [key],duration:duration}));
            }
            this._curTotalTimes[this._staves.length-1]=TotalTime;
        }
        else{
            alert("The measure is insufficient to accommodate this note.");
        }
    }
    resetBPM(bpm){
        this._bpm=bpm;
    }
    trueDuration(duration){
        let time=0;
        if(duration[0]=='w'){
            time+=1;
        }else if(duration[0]=='h'){
            time+=0.5;
        }else if(duration[0]=='q'){
            time+=1.0/4;
        }else if(duration[0]=='8'){
            time+=1.0/8;
        }else if(duration[0]=='1'){
            time+=1.0/16;
        }else if(duration[0]=='3'){
            time+=1.0/32;
        }else if(duration[0]=='6'){
            time+=1.0/64;
        }
        return time*this._beat_value;
    }
    addBeamAndDraw(){//对每个小节里的音符添加Beam
        this._measures.forEach((measure)=>{
            let notes=[];
            let time=0;
            measure.forEach((note)=>{
                if(note.duration[0]!='w'&&note.duration[0]!='q'&&note.duration[0]!='h'&&note instanceof TabNote){
                    notes.push(note);
                    time+=this.trueDuration(note.duration);
                    if(time>=1||notes.length>1){
                        new Beam(notes).setContext(this._context).draw();
                        console.log("addBeam");
                        if(time>=1)
                        {
                            notes=[];
                            time=0;
                        }
                    }
                }
                else notes=[];
            })
        })
    }
    setFormatAndDrawNote(){//使用Voice来规范音符的显示位置
        this._measures.forEach((measure,index)=>{
            console.log("draw");
            if(measure.length==0){ 
                return;
            }
            let curTotalTime=this._curTotalTimes[index];
            let newvoice=new Voice({num_beats:this._num_beats,beat_value:this._beat_value});
            if(Math.abs(curTotalTime-this._beat_value)<0.001){
                newvoice.addTickables(measure);
                new Formatter().joinVoices([newvoice]).format([newvoice],180);
                console.log("yes~");
                newvoice.draw(this._context,this._staves[index]);
            }
            else{
                Formatter.FormatAndDraw(this._context,this._staves[index],measure);
            }
        })
    }
    drawStave(){
        this._staves.forEach((stave)=>{
            stave.setContext(this._context).draw();
        })
    }
    draw(){//绘制所有音符，Beam
        if(!this._isInputTable) this._renderer.resize(1200,130);
        this._context.clear();
        this.drawStave();
        this.setFormatAndDrawNote();
        this.addBeamAndDraw();
    }
    reset(num_beats=4,beat_value=4,divid="table",bpm=60,defaultPos=10,defaultWidth=200,defaultRenderWidth=1200){
        this._isInputTable=(defaultWidth!=200);
        this._num_beats=num_beats;
        this._beat_value=beat_value;
        this._measures=[[]];//每个小节的音符
        this._div=document.getElementById(divid);
        if(!this._isInitialized){
            this._renderer= new Renderer(this._div, Renderer.Backends.SVG);
            this._context=this._renderer.getContext();
            this._isInitialized=true;
        }
        this._beams=[];//每个小节的Beam
        if(this._isInputTable)
        this._staves=[new TabStave(defaultPos, 0, defaultWidth)];//小节谱
        else 
        this._staves=[new TabStave(defaultPos, 0, 250).addClef("tab").addTimeSignature(String(this._beat_value)+"/"+String(this._num_beats))];//小节谱
        this._curTotalTimes=[0];//每个staves总共的时间
        this._playhead=0;//进度头
        if(this._isInputTable)
        this._renderer.resize(100, 160);
        else
        this._renderer.resize(defaultRenderWidth,130);
        this._bpm=bpm;
        this._context.clear();
        this.draw();
    }

    toTarget(){
        let starttime=0;
        let dt=60.0/this._bpm; //每拍多少秒，四分音符的时值
        let tableinfo="fromweb\n";
        this._measures.forEach((measure,index)=>{
            measure.forEach((note)=>{
                const duration=this.trueDuration(note.duration)/this._beat_value*4*dt;
                if(note instanceof TabNote){
                    const positions=note.positions;
                    positions.forEach((position)=>{
                        tableinfo+=String(position.str)+" "+String(position.fret)+" "+String(starttime)+" "+String(duration)+"\n";
                    })
                }
                starttime+=duration;
            })
        })
        tableinfo+="ok";
        return tableinfo;
    }
}
