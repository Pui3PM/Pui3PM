(function(root,factory){
  const dep=typeof module!=='undefined'&&module.exports?require('./identity_material'):root.ShadowIdentityMaterial;
  const api=factory(dep);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.ShadowIdentityBrowser=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(material){
  'use strict';
  async function frameUID(fields,cryptoLike=globalThis.crypto){
    if(!material)throw new Error('ShadowIdentityMaterial unavailable');
    material.validateIdentityFields(fields);
    if(!cryptoLike?.subtle?.digest)throw new Error('WebCrypto SHA-256 unavailable');
    const digest=await cryptoLike.subtle.digest('SHA-256',material.frameIdentityBytes(fields));
    return material.uidFromDigestBytes(new Uint8Array(digest));
  }
  return{frameUID};
});
