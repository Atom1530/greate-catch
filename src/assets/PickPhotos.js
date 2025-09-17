// src/assets/PickPhotos.js
import PhotoBank from './PhotoBank.js';

const PickPhotos = {
  keyFor(id){ return PhotoBank.keyForPick(id); },
  fileFor(id){ return PhotoBank.fileForPick(id); },
  idsForLocation(locId){ return PhotoBank.pickIdsForLocation(locId); },
  queueForScene(scene, locId){ return PhotoBank.queueForScene(scene, locId, { fish:false, pick:true }); },
  ensureOne(scene, id){ return PhotoBank.ensureOne(scene, id, 'pick'); }
};

export default PickPhotos;
