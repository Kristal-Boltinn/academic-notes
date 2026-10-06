import Engine from '../src/indexing/engine';
import { DEFAULTS } from '../src/settings';
import { titleRecord, mediaRecord } from '../src/rendering/adapters';
import { renderEnvironmentSettings } from '../src/ui/environment-settings';
import DocCore from '../src/export/document';
import { setLanguage } from '../src/i18n';
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const wait = () => new Promise(resolve => setTimeout(resolve, 80));
function callout(parent: HTMLElement, key: string, title: string) {
    const box = parent.createDiv({cls:'callout',attr:{'data-callout':key}});
    const heading = box.createDiv({cls:'callout-title'}); heading.createDiv({cls:'callout-icon',text:'Native icon'}); heading.createDiv({cls:'callout-title-inner',text:title});
    box.createDiv({cls:'callout-content'}).createEl('p',{text:'Synthetic body text.'}); return box;
}
export async function runEnvironmentRegressions() {
    setLanguage('en');
    const host=document.body.createDiv({cls:'markdown-rendered'}); host.style.width='720px';
    const plugin:any={settings:{...DEFAULTS},saveSettings:async()=>{}};
    renderEnvironmentSettings(host,plugin);
    const rows=()=>[...host.querySelectorAll<HTMLElement>('.setting-item')];
    const row=(name:string,last=false)=>{ const found=rows().filter(el=>el.firstElementChild?.textContent===name);check(found.length,'Missing setting: '+name);return last?found[found.length-1]:found[0]; };
    const change=(name:string,value:string,last=false)=>{const input=row(name,last).querySelector<HTMLInputElement>('input')!;input.value=value;input.dispatchEvent(new Event('change'));};
    const button=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
    change('Display name','算法');change('Reference abbreviation','算');change('Reference format for this environment','{abbr} {number}');button('Save').click();await wait();
    check(Engine.referenceOverrides(plugin.settings).algorithm.abbr==='算','Multilingual reference settings must persist after Save');
    change('Environment ID','observation');change('Display name','Observation',true);change('Reference abbreviation','obs',true);change('Light-mode accent','#4488aa');change('Dark-mode accent','#aaddff');button('Save environment').click();await wait();
    check(Engine.environments(plugin.settings).observation.light==='#4488aa','Custom environment and colors must persist through the real form');
    check(row('Environment ID').querySelector<HTMLInputElement>('input')!.disabled,'Saved custom IDs must remain immutable');
    const source='> [!observation] Compactness\n> Body\n\n^obs-one';
    const note=Engine.parse('one.md',source,{},plugin.settings), graph=Engine.graph([note],plugin.settings);
    const custom=callout(host,'observation','Compactness');titleRecord(custom,note.theorems[0],graph);
    check(custom.querySelector('.phb-type-label')?.textContent==='Observation 1','Custom environment must render its own display name and number');
    check(getComputedStyle(custom).borderTopWidth!=='0px','Custom boxed environment must retain its border under the theme');
    check(getComputedStyle(custom).borderTopColor==='rgb(68, 136, 170)','Custom light color must style the box');
    document.body.classList.replace('theme-light','theme-dark');check(getComputedStyle(custom).borderTopColor==='rgb(170, 221, 255)','Custom dark color must follow the application theme');document.body.classList.replace('theme-dark','theme-light');
    const plainSettings={...plugin.settings,customEnvironments:JSON.stringify({aside:{name:'Aside',abbr:'as',style:'remark',numbered:false,light:'#884422',dark:'#ddbb88'}})};
    const plainNote=Engine.parse('plain.md','> [!aside] Note\n> Body',{},plainSettings), plainGraph=Engine.graph([plainNote],plainSettings);
    const plain=callout(host,'aside','Note');titleRecord(plain,plainNote.theorems[0],plainGraph);check(getComputedStyle(plain).borderTopWidth==='0px','Remark-style custom environment must stay unboxed');
    check(getComputedStyle(plain.querySelector('.callout-title')!).color==='rgb(136, 68, 34)','Plain custom heading must use its accent');
    const fixtureStyle=host.createEl('style',{text:'body.an-active .markdown-rendered p{text-align:justify!important;text-indent:2em}'});
    const fig=callout(host,'figure','Centered image');const content=fig.querySelector<HTMLElement>('.callout-content')!;content.replaceChildren();
    const paragraph=content.createEl('p'), embed=paragraph.createSpan({cls:'internal-embed image-embed'}), img=embed.createEl('img',{attr:{src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#4488aa"/></svg>'),width:'200',height:'120'}});
    mediaRecord(fig,{kind:'figure',key:'figure',line:0,title:'Centered image',number:'1'} as any);
    await img.decode();
    for(const width of [320,720]) {host.style.width=width+'px';await wait();const f=fig.getBoundingClientRect(),i=img.getBoundingClientRect();check(Math.abs((f.left+f.right)-(i.left+i.right))<2,'Sized figure image must stay centered despite theme paragraph justification and indentation');}
    fixtureStyle.remove();
    // Export links target the rendered custom environment, without a second counter.
    const root=document.body.createEl('main');root.id='phb-document';const first=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'one.md','data-title':'One'}}),second=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'two.md','data-title':'Two'}});
    first.appendChild(custom);custom.dataset.phbBlock='obs-one';const link=second.createEl('a',{cls:'internal-link',text:'obs 1',attr:{href:'one#^obs-one'}});
    const meta=DocCore.prepare(root,{preNumbered:true,toc:false,book:false});check(link.dataset.phbResolved===custom.id&&!meta.warnings.length,'Custom environment cross-file export links must resolve');
    root.remove();host.remove();
    return 'Environment forms, multilingual names, custom counters/colors, centered sized images and export anchors passed.';
}
