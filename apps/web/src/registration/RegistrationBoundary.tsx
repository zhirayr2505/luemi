import {Component,type ErrorInfo,type ReactNode} from "react";
/** Last-resort view only: it never removes localStorage/IndexedDB or images. */
export class RegistrationBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,_info:ErrorInfo){
  // Local-only diagnostic; do not include user drafts or Telegram initData.
  console.error("LUEMI registration rendering failed:",error.name);
 }
 render(){
  if(!this.state.failed)return this.props.children;
  return <main className="luemi-shell" data-phase="welcome" role="alert">
   <section className="entry-state">
    <h1>Не удалось открыть регистрацию</h1>
    <p>Черновик и фотографии на устройстве не удалены.</p>
    <button className="primary-action" type="button"
     onClick={()=>window.location.reload()}>Повторить открытие</button>
   </section>
  </main>;
 }
}
