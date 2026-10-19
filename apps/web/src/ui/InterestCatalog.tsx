import type {CSSProperties} from "react";
import type {LucideIcon} from "lucide-react";
import {Music,Plane,Clapperboard,UtensilsCrossed,Dumbbell,BookOpen,Camera,Palette,
 Drama,Paintbrush,Footprints,Mountain,Activity,Flower2,Waves,Coffee,Gamepad2,Leaf,
 PawPrint,Languages,PersonStanding,Heart,Star,Shapes} from "lucide-react";

interface Item {name:string;icon:LucideIcon;colors:readonly [string,string]}
interface Category {name:string;icon:LucideIcon;colors:readonly [string,string];items:Item[]}
const item=(name:string,icon:LucideIcon,from:string,to:string):Item=>({name,icon,colors:[from,to]});
export const categories:Category[]=[
{name:"Популярное",icon:Star,colors:["#ded0fb","#f3d8ea"],items:[
 item("Музыка",Music,"#e1cbf6","#f3dcef"),item("Путешествия",Plane,"#f6d6ea","#f7c6df"),
 item("Кино",Clapperboard,"#d8e3ff","#eddcf8"),item("Кулинария",UtensilsCrossed,"#ffe6d5","#f8d6e2"),
 item("Спорт",Dumbbell,"#def0e5","#dbe9ff"),item("Книги",BookOpen,"#e5dafa","#f5e0f5")]},
{name:"Творчество",icon:Palette,colors:["#e4d7f8","#dfdafa"],items:[
 item("Фотография",Camera,"#f9dce7","#f8e7d8"),item("Рисование",Paintbrush,"#d9defb","#e7d7f7"),
 item("Танцы",PersonStanding,"#fde3e7","#f5d8f7"),item("Дизайн",Shapes,"#dcecf6","#d7dffb"),
 item("Театр",Drama,"#ead9ef","#d8e8f9")]},
{name:"Активность",icon:Activity,colors:["#d7ebdf","#d9e7f5"],items:[
 item("Прогулки",Footprints,"#f6e5d4","#f4d6ec"),item("Походы",Mountain,"#e2ecdb","#d8e4fa"),
 item("Фитнес",Dumbbell,"#ece1f9","#e9d7ed"),item("Йога",Flower2,"#e3eff4","#d3e8f0"),
 item("Плавание",Waves,"#f5e0e0","#f8dfea")]},
{name:"Досуг",icon:Heart,colors:["#f4dbea","#f6e6d4"],items:[
 item("Кофе",Coffee,"#e0e5fc","#f1dff7"),item("Игры",Gamepad2,"#f6e6d4","#f3dce7"),
 item("Природа",Leaf,"#d7efe4","#e4e8fa"),item("Животные",PawPrint,"#f6dce3","#eadcf8"),
 item("Языки",Languages,"#ddf0f0","#e0e4fa")]}
];
export const interests=categories.flatMap(c=>c.items);
export function itemOf(name:string):Item|undefined{return interests.find(x=>x.name===name);}
export function tint([from,to]:readonly [string,string]):CSSProperties {
 return {"--chip-from":from,"--chip-to":to} as CSSProperties;
}
export function InterestChip({name,selected,onClick}:{name:string;selected?:boolean;onClick?:()=>void}){
 const item=itemOf(name);const Icon=item?.icon??Star;
 const cls="chip toned interest-chip"+(selected?" selected":"");
 const content=<><Icon size={16} strokeWidth={1.8} aria-hidden="true"/><span>{name}</span></>;
 return onClick?<button type="button" className={cls} style={tint(item?.colors??["#e6d2f7","#f3d8eb"])} aria-pressed={!!selected} onClick={onClick}>{content}</button>:
   <span className={cls} style={tint(item?.colors??["#e6d2f7","#f3d8eb"])}>{content}</span>;
}
