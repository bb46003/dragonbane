const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export default class DoDCharacterCreation extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(...args) {
        super(...args);

        this._state = {
            selectedKinIndex: 0,
            selectedProfessionIndex: 0,
            activeTab: "kin"
        };

        this._onKinChange = this._onKinChange.bind(this);
        this._onProfessionChange = this._onProfessionChange.bind(this);
    }

    // =========================
    // OPTIONS
    // =========================

    static DEFAULT_OPTIONS = {
        id: "character-creator",
        tag: "form",
        window: {
            title: "DoD.characterCreator",
            contentClasses: ["dragonbane", "standard-form"],
            resizable: true,
            icon: "fa-solid fa-gears",
        },
        position: {
            width: 480
        },
        actions:{
            random: DoDCharacterCreation.#rollRandom,
            changeTab: DoDCharacterCreation.#changeTab,

        }
    };

    static PARTS = {
        main: {
            template: "systems/dragonbane/templates/apps/character-creation/character-creation.hbs",
        },
        profession:{
            template: "systems/dragonbane/templates/apps/character-creation/character-creation-profession.hbs",
        },
        kin:{
           template: "systems/dragonbane/templates/apps/character-creation/character-creation-kin.hbs", 
        }
    };
  static TABS = {
    items: {
      tabs: [
        { id: "kin"},
        { id: "profession" },
      ],
    },
  };
    // =========================
    // CONTEXT
    // =========================

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        context.kin = await this._prepareKin();
        context.profession = await this._prepareProfession();
        context.numbersOfKins = context.kin.length;
        context.numbersOfProfession = context.profession.length;
        context.selectedKin = context.kin[this._state.selectedKinIndex];
        context.selectedProfession = context.profession[this._state.selectedProfessionIndex];
        context._state = this._state;
        context.tabs[this._state.activeTab].cssClass = "active"
        return context;
    }

    // =========================
    // DATA PREPARATION
    // =========================

    async _prepareKin() {
        const items = game.items.filter(i => i.type === "kin");

        const kin = items.map(async (item) => ({
            name: item.name,
            description: await CONFIG.DoD.TextEditor.enrichHTML(item.system.itemDescription, { async: true, secrets: false }),
            abilities: await this._getAbility(item.system?.abilities),
            movement: item.system?.movement ?? 0
        }));

          return Promise.all(kin);
    }

    async _prepareProfession() {
        const items = game.items.filter(i => i.type === "profession");

        const profesion = items.map(async (item) => ({
            name: item.name,
            description: await CONFIG.DoD.TextEditor.enrichHTML(item.system.itemDescription, { async: true, secrets: false }),
            skills: item.system?.skills.split(",") ?? [],
            keyAtr: item.system?.attribute?.toUpperCase() ?? "",
            abilities: await this._getAbility(item.system?.abilities),
        }));
        return Promise.all(profesion)
    }
async _getAbility(namesString) {
    // Split and clean names
    const names = namesString
        .split(",")
        .map(n => n.trim().toLowerCase());

    // Filter abilities
    const abilities = game.items.filter(item =>
        item.type === "ability" &&
        names.includes(item.name.toLowerCase())
    );
    abilities.forEach(async (abilitie) =>{
        abilitie.itemDescriptionHTML = await CONFIG.DoD.TextEditor.enrichHTML(abilitie.system.itemDescription, { async: true, secrets: false });
    })
    return abilities


}

    // =========================
    // RENDER HOOK
    // =========================

    async _onRender(context, options) {
        await super._onRender(context, options);

        const element = this.element;

        const kinSelect = element.querySelector('select[name="kin"]');
        const professionSelect = element.querySelector('select[name="profession"]');

        kinSelect?.addEventListener("change", this._onKinChange);
        professionSelect?.addEventListener("change", this._onProfessionChange);
    }

    // =========================
    // EVENT HANDLERS
    // =========================

    _onKinChange(event) {
        const index = Number(event.target.value);
        this._state.selectedKinIndex = index;
        this.render({force:true});
    }

    _onProfessionChange(event) {
        const index = Number(event.target.value);
        this._state.selectedProfessionIndex = index;
         this.render({force:true});
    }

    static async #rollRandom(event){
        const target = event.target;
        const dice = target.dataset.dice;
        const type = target.dataset.type
        const formula = `1d${dice}`
        const roll = new Roll(formula)
        await roll.evaluate()
        switch(type){
            case "kin":
                this._state.selectedKinIndex = roll.total;
                break;
            case "profession":
                this._state.selectedProfessionIndex = roll.total;
                break;
        }

        this.render();
        await roll.toMessage()
    }

static #changeTab(ev){
  ev.preventDefault();

  const target = ev.target;
  const direction = Number(target.dataset.type);

  const tabs = ["kin","profession","atributes","skill","weaknes","gear","memento","aperance"];

  const app = this;

  const currentTab = app.form.querySelector(".tab.active");
  const currentTabName = currentTab.dataset.tab;

  let index = tabs.indexOf(currentTabName);
  if (index === -1) index = 0;

  const nextIndex = index + direction;
  const nextTabName = tabs[nextIndex];

  const nextTab = app.form.querySelector(`.tab[data-tab="${nextTabName}"]`);
    const previousButton = app.form.querySelector('button[data-type="-1"]');
 
  if(nextIndex > 0){
        previousButton.disabled = false
    }else{
previousButton.disabled = true
    }
    this._state.activeTab = nextTabName;
  currentTab.classList.remove("active");
  nextTab.classList.add("active");

}
}