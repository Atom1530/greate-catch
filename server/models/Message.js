import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  roomId:   { type:String, index:true }, // = locationId (lake, river_1, ...)
  type:     { type:String, enum:['chat','catch'], default:'chat' },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  username: { type:String },
  text:     { type:String, default:'' },
  payload:  { type:Object, default:{} }, // для 'catch': { fishId, weightKg, lengthCm, rarity, photoKey }
  createdAt:{ type:Date, default:Date.now }
}, { versionKey:false });

export default mongoose.model('Message', MessageSchema);
