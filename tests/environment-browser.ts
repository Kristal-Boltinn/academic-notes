import { EditorState, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType } from '@codemirror/view';
import { AcademicSettings } from '../src/ui/settings-tab';
import AcademicNotes from '../src/main';
import { paletteOverrides, PRESETS } from '../src/rendering/palettes';
import Engine from '../src/indexing/engine';
import { DEFAULTS } from '../src/settings';
import { titleRecord, mediaRecord } from '../src/rendering/adapters';
import { renderEnvironmentSettings } from '../src/ui/environment-settings';
import DocCore from '../src/export/document';
import { showSettingTab } from './browser-host';
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
    const bodyStyles = document.body.getAttribute('style'), bodyPalette = document.body.dataset.anPalette;
    const plugin:any={active:true,appearanceBefore:{variables:{}},settings:{...DEFAULTS},saveSettings:async()=>{AcademicNotes.prototype.applyAppearance.call(plugin);}};
    renderEnvironmentSettings(host,plugin);
    const rows=()=>[...host.querySelectorAll<HTMLElement>('.setting-item')];
    const row=(name:string,last=false)=>{ const found=rows().filter(el=>el.querySelector('.setting-item-name')?.textContent===name);check(found.length,'Missing setting: '+name);return last?found[found.length-1]:found[0]; };
    const change=(name:string,value:string,last=false)=>{const input=row(name,last).querySelector<HTMLInputElement>('input')!;input.value=value;input.dispatchEvent(new Event('change'));};
    const button=(text:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text)!;
    change('Display name','算法');change('Reference abbreviation','算');change('Reference format for this environment','{abbr} {number}');button('Save').click();await wait();
    check(Engine.referenceOverrides(plugin.settings).algorithm.abbr==='算','Multilingual reference settings must persist after Save');
    const select=host.querySelector<HTMLSelectElement>('select')!;select.value='';select.dispatchEvent(new Event('change'));
    check(host.querySelectorAll('select').length===2,'One consolidated editor must expose selection and custom base, without a duplicate reference form');
    change('Environment ID','observation');change('Display name','Observation');change('Reference abbreviation','obs');button('Save').click();await wait();
    check(Engine.environments(plugin.settings).observation.name==='Observation','Custom environment must persist through the unified form');
    check(row('Environment ID').querySelector<HTMLInputElement>('input')!.disabled,'Saved custom IDs must remain immutable');
    plugin.settings.paletteAppearance=JSON.stringify({forest:{observation:{light:'#4488aa',motif:'laurel'},algorithm:{light:'#884422'}},radiation:{observation:{dark:'#aaddff'}}});await plugin.saveSettings();
    const source='> [!observation] Compactness\n> Body\n\n^obs-one';
    const note=Engine.parse('one.md',source,{},plugin.settings), graph=Engine.graph([note],plugin.settings);
    const custom=callout(host,'observation','Compactness');titleRecord(custom,note.theorems[0],graph);
    check(custom.querySelector('.phb-type-label')?.textContent==='Observation 1','Custom environment must render its own display name and number');
    check(getComputedStyle(custom).borderTopWidth!=='0px','Custom boxed environment must retain its border under the theme');
    check(getComputedStyle(custom).borderTopColor==='rgb(68, 136, 170)','Custom light color must style the box');
    document.body.classList.replace('theme-light','theme-dark');await plugin.saveSettings();check(getComputedStyle(custom).borderTopColor==='rgb(170, 221, 255)','Custom dark color must follow the application theme');document.body.classList.replace('theme-dark','theme-light');await plugin.saveSettings();
    const plainSettings={...plugin.settings,customEnvironments:JSON.stringify({aside:{name:'Aside',abbr:'as',style:'remark',numbered:false,light:'#884422',dark:'#ddbb88'}})};
    const plainNote=Engine.parse('plain.md','> [!aside] Note\n> Body',{},plainSettings), plainGraph=Engine.graph([plainNote],plainSettings);
    const plain=callout(host,'aside','Note');titleRecord(plain,plainNote.theorems[0],plainGraph);check(getComputedStyle(plain).borderTopWidth==='0px','Remark-style custom environment must stay unboxed');
    check(getComputedStyle(plain.querySelector('.callout-title')!).color==='rgb(136, 68, 34)','Plain custom heading must use its accent');
    // Palette edits, switching, cloning and reset run through real controls.
    const paletteHost=document.body.createDiv();const tab=new AcademicSettings({} as any,plugin);paletteHost.appendChild(tab.containerEl);showSettingTab(tab);
    const paletteControl=(id:string)=>paletteHost.querySelector<HTMLElement>(`[data-an-control="${id}"]`)!;
    const choose=(id:string,value:string)=>{const el=paletteControl(id) as HTMLSelectElement;el.value=value;el.dispatchEvent(new Event('change'));};
    choose('environment','proof');await wait();const proofPreview=paletteHost.querySelector<HTMLElement>('.an-appearance-preview .callout-title')!, normal=paletteHost.createSpan();normal.style.color='var(--text-normal)';check(getComputedStyle(proofPreview).color===getComputedStyle(normal).color,'Default Proof preview must retain normal text color');
    choose('lightPalette','sakura');await wait();check(getComputedStyle(custom).borderTopColor!=='rgb(68, 136, 170)','Switching palettes must clear previous custom colors');
    choose('environment','observation');await wait();check(!(paletteControl('light') as HTMLInputElement).disabled,'Environment color must be editable directly, without an unlocking toggle');
    const color=paletteHost.querySelector<HTMLInputElement>('input[type=color]')!;color.value='#aa3355';color.dispatchEvent(new Event('change'));await wait();
    check(paletteOverrides(plugin.settings).sakura.observation.light==='#aa3355','Color picker must save only to the selected preset');
    choose('lightPalette','forest');await wait();check(getComputedStyle(custom).borderTopColor==='rgb(68, 136, 170)','Switching back must recover original overrides');
    choose('lightPalette','sakura');await wait();check(getComputedStyle(custom).borderTopColor==='rgb(170, 51, 85)','Another preset must retain its own override');
    choose('lightPalette','new-custom');await wait();
    check(plugin.settings.lightPalette==='sakura','Opening custom creation must preserve the selected palette until Save');
    check(paletteHost.querySelector<HTMLDetailsElement>('.an-palette-management')!.open,'Custom creation must be discoverable in the overall palette selector');
    const name=paletteHost.querySelector<HTMLInputElement>('.an-palette-management input[type=text]')!;name.value='Study palette';name.dispatchEvent(new Event('change'));
    [...paletteHost.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Create palette')!.click();await wait();
    check(plugin.settings.lightPalette.startsWith('custom-'),'Create must select a distinct custom palette');
    check(getComputedStyle(custom).borderTopColor==='rgb(170, 51, 85)','Copy must preserve current appearance');
    paletteControl('resetPalette').click();await wait();check(getComputedStyle(custom).borderTopColor!=='rgb(170, 51, 85)','Reset must use the custom palette base defaults');
    choose('lightPalette','sakura');await wait();check(getComputedStyle(custom).borderTopColor==='rgb(170, 51, 85)','Reset of a clone must not affect its original');
    choose('environment','thm');await wait();choose('lightPalette','theme');await wait();
    const themedPreview=paletteHost.querySelector<HTMLElement>('.an-appearance-preview .callout')!;
    document.body.style.setProperty('--text-accent','#8855aa');const oldPreview=getComputedStyle(themedPreview).borderTopColor;
    document.body.style.setProperty('--text-accent','#337d67');check(getComputedStyle(themedPreview).borderTopColor!==oldPreview,'Theme-accent previews must update along with note colors');
    document.body.style.removeProperty('--text-accent');
    paletteHost.remove();
    // Later legacy/theme rules must not win over the chosen runtime palette.
    const legacyStyle=host.createEl('style',{text:'body.theme-light.an-active[data-an-palette] { --phb-lem:#8855aa; --phb-prop:#44aa55; }'});
    const lemma=callout(host,'lemma','Lemma'), proposition=callout(host,'proposition','Proposition');
    for(const palette of ['forest','sakura','forest']) {
      plugin.settings.lightPalette=palette;await plugin.saveSettings();
      for(const [box,role] of [[lemma,'lem'],[proposition,'prop']] as const) {
        const swatch=host.createSpan();swatch.style.color=PRESETS[palette].colors[role];
        check(getComputedStyle(box).borderTopColor===getComputedStyle(swatch).color,'Actual boxed '+role+' must switch with '+palette+' despite legacy stylesheet');swatch.remove();
      }
    }
    document.body.classList.replace('theme-light','theme-dark');await plugin.saveSettings();
    check(document.body.style.getPropertyValue('--phb-lem')===PRESETS.radiation.colors.lem,'Switching light/dark must select that mode’s own preset');
    plugin.settings.darkPalette='theme';await plugin.saveSettings();check(document.body.style.getPropertyValue('--phb-lem').includes('--text-accent'),'Theme mode must derive all environment colors from the host accent');
    document.body.classList.replace('theme-dark','theme-light');await plugin.saveSettings();legacyStyle.remove();lemma.remove();proposition.remove();
    plugin.settings.lightPalette='theme';await plugin.saveSettings();
    const themed=callout(host,'lemma','Theme accent');
    document.body.style.setProperty('--text-accent','#8855aa');const purple=getComputedStyle(themed).borderTopColor;
    document.body.style.setProperty('--text-accent','#337d67');const green=getComputedStyle(themed).borderTopColor;
    check(purple!==green,'Changing theme accent must update lemma color without saving plugin settings');
    plugin.settings.lightPalette='forest';await plugin.saveSettings();const fixed=getComputedStyle(themed).borderTopColor;
    document.body.style.setProperty('--text-accent','#8855aa');check(fixed===getComputedStyle(themed).borderTopColor,'Fixed presets must stay independent of host accent');
    document.body.style.removeProperty('--text-accent');themed.remove();
    // Reference formats have one editor; the field displays its inherited fallback.
    const settingsHost=host.createDiv();const unifiedTab=new AcademicSettings({} as any,plugin);settingsHost.appendChild(unifiedTab.containerEl);showSettingTab(unifiedTab);
    const env=unifiedTab.containerEl.querySelector<HTMLSelectElement>('[data-an-control=environment]')!;env.value='algorithm';env.dispatchEvent(new Event('change'));
    check(![...unifiedTab.containerEl.querySelectorAll('.setting-item')].some(el=>['Algorithm reference format','Figure reference format','Table reference format','Equation reference format'].includes(el.querySelector('.setting-item-name')?.textContent || '')),'Exclusive environments must not have duplicate global format controls');
    check(unifiedTab.containerEl.querySelector('input[placeholder="{abbr} {number}"]'),'Algorithm field must reflect the inherited abbreviation-aware format');settingsHost.remove();
    // Every native image wrapper, including readonly CodeMirror widgets, must center.
    const fixtureStyle=host.createEl('style',{text:'.cm-contentContainer{display:flex;align-items:stretch}.markdown-source-view.mod-cm6 .cm-content > * {margin:0!important;display:block}.markdown-source-view.mod-cm6 .cm-content>.image-embed{display:flex}.cm-content .image-embed{width:fit-content}.cm-content .image-embed .image-wrapper{display:flex;position:relative}.image-resize-corner{position:absolute;bottom:0;right:0;width:30px;height:30px} body.an-active .markdown-rendered p,body.an-active .markdown-source-view .cm-line,body.an-active .markdown-source-view .cm-embed-block{text-align:justify!important;text-indent:2em} body.an-active .image-embed img{margin-left:0!important}'});
    const imageSource='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#4488aa"/></svg>');
    const addImage=(parent:HTMLElement,wrapper:string)=>{
      const fig=callout(parent,'figure','Centered image'),content=fig.querySelector<HTMLElement>('.callout-content')!;content.replaceChildren();
      const holder=wrapper==='native-1.14'?content.createDiv({cls:'cm-sizer'}).createDiv({cls:'cm-contentContainer'}).createDiv({cls:'cm-content'}):wrapper==='direct'?content:wrapper==='p'?content.createEl('p'):content.createDiv({cls:wrapper});
      const embed=wrapper==='native-1.14'?holder.createDiv({cls:'internal-embed image-embed'}):holder.createSpan({cls:'internal-embed image-embed'});
      const imageParent=wrapper==='native-1.14'?embed.createDiv({cls:'image-wrapper'}):embed;
      const img=imageParent.createEl('img',{attr:{src:imageSource,width:'200',height:'120'}});
      if(wrapper==='native-1.14')imageParent.createDiv({cls:'image-resize-corner'});
      mediaRecord(fig,{kind:'figure',key:'figure',line:0,title:'Centered image',number:'1'} as any);return {fig,img};
    };
    const fixtures=[addImage(host,'p')];
    const liveHost=host.createDiv({cls:'markdown-source-view mod-cm6'});
    class ImageWidget extends WidgetType {toDOM(){const wrapper=document.createElement('div');wrapper.contentEditable='false';for(const cls of ['direct','cm-line','cm-embed-block','native-1.14'])fixtures.push(addImage(wrapper,cls));return wrapper;}}
    const widgets=StateField.define({create:()=>Decoration.set([Decoration.widget({widget:new ImageWidget(),block:true}).range(0)]),update:value=>value,provide:field=>EditorView.decorations.from(field)});
    const view=new EditorView({parent:liveHost,state:EditorState.create({doc:'Image fixture',extensions:[widgets]})});
    try {await Promise.all(fixtures.map(({img})=>img.decode()));
      for(const width of [320,720]){host.style.width=width+'px';view.requestMeasure();await wait();for(const {fig,img} of fixtures){const f=fig.getBoundingClientRect(),i=img.getBoundingClientRect();check(Math.abs(i.width-200)<1 && Math.abs(i.height-120)<1,'Centering must preserve requested image dimensions');const corner=fig.querySelector<HTMLElement>('.image-resize-corner');if(corner){const c=corner.getBoundingClientRect();check(Math.abs(c.right-i.right)<1&&Math.abs(c.bottom-i.bottom)<1,'Native resize handle must stay anchored to the image');}check(Math.abs((f.left+f.right)-(i.left+i.right))<2,'Sized image must center in reading and every native Live Preview wrapper: '+JSON.stringify({width,wrapper:img.parentElement?.parentElement?.className,fig:f.toJSON(),img:i.toJSON(),styles:[img,img.parentElement,img.parentElement?.parentElement,img.parentElement?.parentElement?.parentElement,img.parentElement?.parentElement?.parentElement?.parentElement].map(el=>el && ({tag:el.tagName,cls:el.className,display:getComputedStyle(el).display,width:getComputedStyle(el).width,height:getComputedStyle(el).height}))}));}}
    }finally{view.destroy();fixtureStyle.remove();}
    // The algorithm rule hue comes from the palette's primary accent.
    for(const palette of ['forest','sakura']){plugin.settings.lightPalette=palette;await plugin.saveSettings();document.body.style.removeProperty('--an-color-algorithm');const algorithm=callout(host,'algorithm','Palette algorithm');const expected=document.createElement('span');expected.style.color=PRESETS[palette].colors.def;host.appendChild(expected);check(getComputedStyle(algorithm).borderTopColor===getComputedStyle(expected).color,'Algorithm rules must follow '+palette+' primary hue');algorithm.remove();expected.remove();}
    // Export links target the rendered custom environment, without a second counter.
    const root=document.body.createEl('main');root.id='phb-document';const first=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'one.md','data-title':'One'}}),second=root.createEl('section',{cls:'phb-chapter',attr:{'data-path':'two.md','data-title':'Two'}});
    first.appendChild(custom);custom.dataset.phbBlock='obs-one';const link=second.createEl('a',{cls:'internal-link',text:'obs 1',attr:{href:'one#^obs-one'}});
    const meta=DocCore.prepare(root,{preNumbered:true,toc:false,book:false});check(link.dataset.phbResolved===custom.id&&!meta.warnings.length,'Custom environment cross-file export links must resolve');
    root.remove();host.remove();if(bodyStyles===null)document.body.removeAttribute('style');else document.body.setAttribute('style',bodyStyles);document.body.dataset.anPalette=bodyPalette || 'forest';delete document.body.dataset.anProfile;
    return 'Environment forms, multilingual names, custom counters/colors, centered sized images and export anchors passed.';
}
