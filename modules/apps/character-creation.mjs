const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export default class DoDCharacterCreation extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(...args) {
        super(...args);

        // UI state
        this._state = {
            selectedKinIndex: 0,
            selectedProfessionIndex: 0
        };

        // Bind handlers (VERY IMPORTANT)
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
            randomKin: DoDCharacterCreation.#rollRandom
        }
    };

    static PARTS = {
        body: {
            template: "systems/dragonbane/templates/apps/character-creation/character-creation.hbs",
            root: true
        }
    };

    // =========================
    // CONTEXT
    // =========================

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        context.kin = await this._prepareKin();
        context.profession = await this._prepareProfession();
        context.numbersOfKins = context.kin.length;
        context.selectedKin = context.kin[this._state.selectedKinIndex];
        context.selectedProfession = context.profession[this._state.selectedProfessionIndex];
        context._state = this._state;
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
            skills: item.system?.skills ?? [],
            gear: item.system?.gear ?? []
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

        const kinSelect = element.querySelector('select[data-kin]');
        const professionSelect = element.querySelector('select[data-profession]');

        // Remove previous listeners (important after re-render)
        kinSelect?.removeEventListener("change", this._onKinChange);
        professionSelect?.removeEventListener("change", this._onProfessionChange);

        // Add listeners
        kinSelect?.addEventListener("change", this._onKinChange);
        professionSelect?.addEventListener("change", this._onProfessionChange);
    }

    // =========================
    // EVENT HANDLERS
    // =========================

    _onKinChange(event) {
        const index = Number(event.target.value);
        this._state.selectedKinIndex = index;
        this.render();
    }

    _onProfessionChange(event) {
        const index = Number(event.target.value);
        this._state.selectedProfessionIndex = index;
        this.render();
    }

    static async #rollRandom(event){
        const target = event.target;
        const dice = target.dataset.dice;
        const formula = `1d${dice}`
        const roll = new Roll(formula)
       await roll.evaluate()
        this._state.selectedKinIndex = roll.total;
        this.render();
        await roll.toMessage()
    }

    

}