// src/assets/FishPhotos.js
import PhotoBank from './PhotoBank.js';

const FishPhotos = {
  keyFor(id){ return PhotoBank.keyForFish(id); },
  fileFor(id){ return PhotoBank.fileForFish(id); },
  idsForLocation(locId){ return PhotoBank.fishIdsForLocation(locId); },
  queueForScene(scene, locId){ return PhotoBank.queueForScene(scene, locId, { fish:true, pick:false }); },
  ensureOne(scene, id){ return PhotoBank.ensureOne(scene, id, 'fish'); }
};

export default FishPhotos;
