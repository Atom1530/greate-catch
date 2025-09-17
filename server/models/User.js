import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  email:    { type:String, required:true, unique:true, index:true },
  username: { type:String, required:true, unique:true, index:true, minlength:3, maxlength:24 },
  passHash: { type:String, required:true },
  createdAt:{ type:Date, default:Date.now }
}, { versionKey:false });

export default mongoose.model('User', UserSchema);
