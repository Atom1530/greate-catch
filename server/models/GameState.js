import mongoose from 'mongoose';

const GameStateSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref:'User', index:true, unique:true },
  // то, что у тебя в VM:
  wallet:     { coins:{type:Number, default:0}, gold:{type:Number, default:0}, perks:{type:Number, default:0} },
  keepnet:    { type:Array, default:[] },
  keepnetCap: { type:Number, default:25 },
  gear:       { type:Object, default:{} },
  rigDepthM:  { type:Number, default:1.2 },
  locationId: { type:String, default:'lake' },
  level:      { type:Number, default:1 },
  progress:   { type:Object, default:{} }, // твой Progress.xp/level и т.п. (можно детализировать позже)
  inventory:  { type:Object, default:{} },
  activeBaitId:{ type:String, default:'worm' },

  // служебные:
  lastSeen:   { type:Date, default:Date.now },
  rev:        { type:Number, default:0 } // для оптимистичных апдейтов
}, { timestamps:true, versionKey:false });

export default mongoose.model('GameState', GameStateSchema);

