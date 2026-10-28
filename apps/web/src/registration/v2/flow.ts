/**
 * LUEMI Registration V2: approved-design candidate only.
 * All eight stages are client navigation semantics, NOT server permission.
 * The only 'verified' state must come from a signed, server-owned verdict;
 * local camera gestures or this prototype can NEVER produce that result.
 */
export const registrationV2Stages=[
 {id:"identity",title:"Начнём с тебя",eyebrow:"О ТЕБЕ",subtitle:"Имя, дата рождения и немного о тебе.",required:true},
 {id:"location",title:"Где начинается твоя история?",eyebrow:"ТВОЙ ГОРОД",subtitle:"Покажем людей рядом, не раскрывая твои координаты.",required:true},
 {id:"intent",title:"Кого ты хочешь встретить?",eyebrow:"ЗНАКОМСТВА",subtitle:"Настроим знакомства под тебя.",required:true},
 {id:"personality",title:"Чем ты живёшь?",eyebrow:"ТВОЙ МИР",subtitle:"Пусть общение начинается с общего.",required:false},
 {id:"photos",title:"Твои лучшие моменты",eyebrow:"ФОТОГРАФИИ",subtitle:"Добавь три фотографии. Ещё три — по желанию.",required:true},
 {id:"face-consent",title:"Знакомства с доверием",eyebrow:"FACETRUST",subtitle:"Расскажем, как проходит проверка лица.",required:true},
 {id:"liveness",title:"Это действительно ты?",eyebrow:"ЖИВОЕ СЕЛФИ",subtitle:"Короткая проверка через камеру перед публикацией.",required:true},
 {id:"review",title:"Вот каким тебя увидят",eyebrow:"ТВОЯ АНКЕТА",subtitle:"Проверь всё перед публикацией.",required:true}
] as const;

export type RegistrationV2StageId=(typeof registrationV2Stages)[number]["id"];
export type FaceTrustFlowState="not_started"|"consent_required"|
 "awaiting_provider"|"processing"|"eligible"|"retry"|"needs_review"|"revoked";
export interface RegistrationV2Gate {
  selectedPhotos:number;
  hasIdentity:boolean;
  hasLocation:boolean;
  hasIntent:boolean;
  biometricConsent:boolean;
  faceTrust:FaceTrustFlowState;
}
export type TransitionResult={allowed:true;stage:RegistrationV2StageId}|
 {allowed:false;reason:string};
export function stageIndex(id:RegistrationV2StageId):number{
 return registrationV2Stages.findIndex(s=>s.id===id);
}
export function nextRegistrationV2Stage(
 current:RegistrationV2StageId,gate:RegistrationV2Gate
):TransitionResult{
 const index=stageIndex(current);
 if(index<0||index===registrationV2Stages.length-1)
  return{allowed:false,reason:"complete"};
 switch(current){
  case "identity":
   if(!gate.hasIdentity)return{allowed:false,reason:"identity_required"};
   break;
  case "location":
   if(!gate.hasLocation)return{allowed:false,reason:"city_required"};
   break;
  case "intent":
   if(!gate.hasIntent)return{allowed:false,reason:"intent_required"};
   break;
  case "photos":
   if(gate.selectedPhotos<3||gate.selectedPhotos>6)
    return{allowed:false,reason:"three_to_six_photos_required"};
   break;
  case "face-consent":
   if(!gate.biometricConsent)return{allowed:false,reason:"separate_biometric_consent_required"};
   break;
  case "liveness":
   if(gate.faceTrust!=="eligible")
    return{allowed:false,reason:"trusted_liveness_verdict_required"};
   break;
 }
 return{allowed:true,stage:registrationV2Stages[index+1].id};
}
export function canPublishRegistrationV2(gate:RegistrationV2Gate):boolean{
 return gate.hasIdentity&&gate.hasLocation&&gate.hasIntent&&
  gate.selectedPhotos>=3&&gate.selectedPhotos<=6&&
  gate.biometricConsent&&gate.faceTrust==="eligible";
}
export type EnrollmentNotice="draft_only"|"photo_review_pending"|
 "verification_unavailable"|"verified"|"verification_retry"|"verification_review";
export function stateLabel(state:EnrollmentNotice):string{
 switch(state){
  case "draft_only":return "Черновик сохранён. Ты решаешь, когда продолжить.";
  case "photo_review_pending":return "Фотографии проверяются и никому не видны.";
  case "verification_unavailable":return "Проверка лица ещё не подключена. Анкета не опубликована.";
  case "verified":return "Фото подтверждены. Можешь опубликовать анкету.";
  case "verification_retry":return "Проверку не удалось закончить. Попробуй ещё раз.";
  case "verification_review":return "Нужна дополнительная проверка. Анкета пока скрыта.";
 }
}
