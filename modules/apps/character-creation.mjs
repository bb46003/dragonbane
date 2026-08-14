import DoD_Utility from "../utility.js";


const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ApplicationV2 } = foundry.applications.api;

export default class DoDCharacterCreation extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  constructor(...args) {
    super(...args);

    this._state = {
      selectedKinIndex: 0,
      selectedProfessionIndex: 0,
      kin: "",
      name: "",
      age: "",
      attributes: {
        str: 0,
        con: 0,
        agl: 0,
        int: 0,
        wil: 0,
        cha: 0,
      },
      gear: "",
      selectedGear: "",
      memento: "",
      numberOfSelectedSkills: 4,
      selectedSkills: [],
      activeTab: "kin",
      allRolled: false,
      swapAttr: false,
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
      contentClasses: ["system-dragonbane", "standard-form", "overflow", "character-creation"],
      resizable: true,
      icon: "fa-solid fa-gears",
    },
    position: {
      width: 480,
    },
            form: {
            submitOnChange: true,
            closeOnSubmit: false
        },
    actions: {
      random: DoDCharacterCreation.#rollRandom,
      changeTab: DoDCharacterCreation.#changeTab,
      rollTable: DoDCharacterCreation.#rollTable,
      resetAttributes: DoDCharacterCreation.#resetAttributes,
      rollAttributes: DoDCharacterCreation.#rollAttributes,
      swapValues: DoDCharacterCreation.#swapValues,
    },

  };

  static PARTS = {
    main: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation.hbs",
    },
    profession: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-profession.hbs",
    },
    kin: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-kin.hbs",
    },
    age: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-age-name.hbs",
    },
    attributes: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-attributes.hbs",
    },
    skills: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-skills.hbs",
    },
    weakness: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-weakness.hbs",
    },
    gear: {
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-gear.hbs",
    },
    memento:{
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-memento.hbs",
    },
    summary:{
      template:
        "systems/dragonbane/templates/apps/character-creation/character-creation-summary.hbs",
    }
  };
  static TABS = {
    items: {
      tabs: [
        { id: "kin" },
        { id: "profession" },
        { id: "age" },
        { id: "attributes" },
        { id: "skills" },
        { id: "weakness" },
        { id: "gear" },
        { id: "memento" },
        { id: "summary" }
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
    context.profession[this._state.selectedProfessionIndex];
    context._state = this._state;
    context.tabs[this._state.activeTab].cssClass = "active";
    context.config = CONFIG.DoD;
    delete context.config.attributes.none;
    context.ageTable = await this.getAgeTable();
    context.nameTable = await this.getNameTable(context.kin);
    context.skills = await this._prepareSkills(context.profession);
    context.weaknessTable = await this._prepareWeaknessTable();
    context.weaknessHTML = await this.enrich(this._state.weakness);
    context.gearTable = await this._prepareGearTable()
    context.gearTableHTML = await this.enrich("@DisplayTable["+context.gearTable+"]")
    if(context.gearTable){
      context.gearOption = await this._prepareGearOption(context.gearTable)
    }
    context.mementoTable = await this._prepareMementosTable();
    if(this._state.memento === ""){
      context.mementoHTML = ""
    }else{
      context.mementoHTML = await this.enrich("@UUID["+this._state.memento + "]");
      context.mementoName = await this._getMementoName(this._state.memento)
    }
    if(this._state.selectedGear !== ""){
      context.gearName = await this._prepareGearName(this._state.selectedGear)
    }
    return context;
  }
    async enrich(html) {
        if (html) {
            return await CONFIG.DoD.TextEditor.enrichHTML(html, {
                relativeTo: this.document,
                async: true
            });
        } else {
            return html;
        }
    }
  // =========================
  // DATA PREPARATION
  // =========================

  async _prepareKin() {
    const items = game.items.filter((i) => i.type === "kin");

    const kin = items.map(async (item) => ({
      name: item.name,
      description: await CONFIG.DoD.TextEditor.enrichHTML(
        item.system.itemDescription,
        { async: true, secrets: false },
      ),
      abilities: await this._getAbility(item.system?.abilities),
      movement: item.system?.movement ?? 0,
    }));

    return Promise.all(kin);
  }

  async _prepareProfession() {
    const items = game.items.filter((i) => i.type === "profession");

    const profession = items.map(async (item) => ({
      name: item.name,
      description: await CONFIG.DoD.TextEditor.enrichHTML(
        item.system.itemDescription,
        { async: true, secrets: false },
      ),
      skills: item.system?.skills.split(",") ?? [],
      keyAtr: item.system?.attribute?.toUpperCase() ?? "",
      abilities: await this._getAbility(item.system?.abilities),
    }));
    return Promise.all(profession);
  }

  async _getAbility(namesString) {
    const names = namesString.split(",").map((n) => n.trim().toLowerCase());

    const abilities = game.items.filter(
      (item) =>
        item.type === "ability" && names.includes(item.name.toLowerCase()),
    );
    abilities.forEach(async (abilitie) => {
      abilitie.itemDescriptionHTML = await CONFIG.DoD.TextEditor.enrichHTML(
        abilitie.system.itemDescription,
        { async: true, secrets: false },
      );
    });
    return abilities;
  }

  async _prepareSkills(professionList) {
    const allSkills = game.items
      .filter((item) => item.type === "skill" && item.system.skillType !== "magic")
      .map((item) => item.name);
    const selectedProfession =
      professionList[this._state.selectedProfessionIndex];
    if (!selectedProfession) return allSkills;

    const professionSkills = selectedProfession.skills ?? [];

    return {availableSkills:allSkills, professionSkills:professionSkills};
  }
  async getAgeTable() {
    const age = ["Age", game.i18n.localize("DoD.ui.character-sheet.age")];
    const ageTable = game.tables.filter((t) =>
      age.some((word) => t.name.includes(word)),
    );
    return ageTable.length > 0;
  }
  async getNameTable(kin) {
    const kinNames = kin.map((k) => k.name);

    return game.tables.some((table) =>
      kinNames.some((name) => table.name.includes(name)),
    );
  }
  async _prepareWeaknessTable() {
const weakness = [
    "Weakness",
    game.i18n.localize("DoD.ui.character-sheet.weakness")
];

const weaknessTable = game.tables.filter(table =>
    weakness.some(word =>
        table.name.slice(0, 7).toLowerCase() === word.slice(0, 7).toLowerCase()
    )
);
if (weaknessTable.length > 0) {
    const table = weaknessTable[0];
    return table.uuid;
}else{
  return ""
}

  }
async _prepareGearTable() {
    const allProfession = await this._prepareProfession();

    const gear = [
        game.i18n.localize("DoD.ui.character-sheet.gear"),
        "gear"
    ];

    const profession = allProfession[this._state.selectedProfessionIndex];
    const gearTable = game.tables.filter(table => {
        const tableName = table.name.toLowerCase();
        const professionMatch = tableName.includes(
            profession.name.toLowerCase()
        );
        const gearMatch = gear.some(word =>
            tableName.startsWith(word.slice(0, 5).toLowerCase())
        );
        return professionMatch && gearMatch;
    });
    if (gearTable.length > 0) {
        return gearTable[0].uuid;
    }
    return "";
}
async _prepareGearOption(uuid) {
    const gearTable = await fromUuid(uuid);
    const options = [];
    for (const result of gearTable.results) {
        const range = result.range.join("-");
        options.push(`${range}`);
    }
    return options;
}
  async _prepareMementosTable() {
const weakness = [
    "Memento",
    game.i18n.localize("DoD.ui.character-sheet.memento")
];

const weaknessTable = game.tables.filter(table =>
    weakness.some(word =>
        table.name.slice(0, 7).toLowerCase() === word.slice(0, 7).toLowerCase()
    )
);
if (weaknessTable.length > 0) {
    const table = weaknessTable[0];
    return table.uuid;
}else{
  return ""
}
  }
  async _getMementoName(uuid){
    const memento = await fromUuid(uuid)
    return memento.name
  }
  async _prepareGearName(selectedGear){
    const names = [...selectedGear.matchAll(/@UUID\[[^\]]+\]\{([^}]*)\}/g)]
  .map(match => match[1]);
  return names
  }
async _onRender(context, options) {
  await super._onRender(context, options);

  const element = this.element;

  const kinSelect = element.querySelector('select[name="kin"]');
  const professionSelect = element.querySelector('select[name="profession"]');

  kinSelect?.addEventListener("change", this._onKinChange.bind(this));
  professionSelect?.addEventListener("change", this._onProfessionChange.bind(this));

  const selects = element.querySelectorAll('select[data-action="swap"]');

  selects.forEach((select) => {
    select.addEventListener("change", () => {
      this._updateSwapOptions(selects);
    });
  });

  this._updateSwapOptions(selects);

const professionSkillsElement = element.querySelector(".profession-skills");
const otherSkillsElement = element.querySelector(".other-skills");

if (professionSkillsElement && otherSkillsElement) {

  const getInputs = (container) =>
    [...container.querySelectorAll('input[type="checkbox"]')];

  const getSkill = (input) =>
    input.closest('[data-name]')?.dataset.name?.trim();

  const updateSkills = () => {
    const professionSkills = getInputs(professionSkillsElement);
    const otherSkills = getInputs(otherSkillsElement);

    const selectedProfessionSkills = new Set(
      professionSkills.filter(i => i.checked).map(getSkill)
    );

    const selectedOtherSkills = new Set(
      otherSkills.filter(i => i.checked).map(getSkill)
    );

    const maxProfessionSkills = 6;
    const maxOtherSkills = this._state.numberOfSelectedSkills;

    const numberOfProfessionSkills = selectedProfessionSkills.size;
    const numberOfOtherSkills = selectedOtherSkills.size;

  
    professionSkills.forEach(input => {
      const skill = getSkill(input);

      input.disabled =
        (!input.checked && numberOfProfessionSkills >= maxProfessionSkills) ||
        (!input.checked && selectedOtherSkills.has(skill));
    });

    otherSkills.forEach(input => {
      const skill = getSkill(input);
      input.disabled =
        (!input.checked && numberOfOtherSkills >= maxOtherSkills) ||
        (!input.checked && selectedProfessionSkills.has(skill));
    });
  };


  const allCheckboxes = [
    ...getInputs(professionSkillsElement),
    ...getInputs(otherSkillsElement),
  ];

  allCheckboxes.forEach(input => {
    input.addEventListener("change", updateSkills);
  });


  updateSkills();
}


  const inputName = element.querySelector('input[name="name"]');
  inputName?.addEventListener("input", (event) => {
    const nextButton = element.querySelector('button[data-type="1"]');
    if (nextButton) {
      nextButton.disabled = event.target.value.trim() === "";
    }
  });
element.addEventListener('save', async (event) => { 
  const target = event.target
  this._state[target.name] = target.value
  this.render()
})
}
_updateSwapOptions(selects) {
  const selectArray = Array.from(selects);
  const usedValues = new Set();
  selectArray.forEach((select) => {
    if (usedValues.has(select.value)) {
      const newOption = Array.from(select.options).find(
        (option) => !usedValues.has(option.value)
      );

      if (newOption) {
        select.value = newOption.value;
      }
    }

    usedValues.add(select.value);
  });
  selectArray.forEach((select) => {
    const otherSelectedValues = new Set(
      selectArray
        .filter((otherSelect) => otherSelect !== select)
        .map((otherSelect) => otherSelect.value)
    );

    Array.from(select.options).forEach((option) => {
      option.disabled = otherSelectedValues.has(option.value);
    });
  });

  
}


  _onKinChange(event) {
    const index = Number(event.target.value);
    this._state.selectedKinIndex = index;
    this.render({ force: true });
  }

  _onProfessionChange(event) {
    const index = Number(event.target.value);
    this._state.selectedProfessionIndex = index;
    this.render({ force: true });
  }

  static async #rollRandom(event) {
    const target = event.target;
    const dice = target.dataset.dice;
    const type = target.dataset.type;
    const formula = `1d${dice}`;
    const roll = new Roll(formula);
    await roll.evaluate();
    switch (type) {
      case "kin":
        this._state.selectedKinIndex = roll.total - 1;
        break;
      case "profession":
        this._state.selectedProfessionIndex = roll.total - 1;
        break;
    }

    this.render();
    await roll.toMessage();
  }

  static async #rollTable(event) {
    const target = event.target;
    const type = target.dataset.type;

    let table = null;

    if (type === "name") {
      const selectedKin = target
        .closest("form")
        .querySelector('select[name="kin"]');

      const kinName = selectedKin.selectedOptions[0].innerText.trim();

      const kinTables = game.tables.filter((table) =>
        table.name.includes(kinName),
      );

      table = await this.selectTable(kinTables, kinName);
    } else if (type === "age") {
      const ageTables = game.tables.filter(
        (table) =>
          table.name.includes("Age") ||
          table.name.includes(game.i18n.localize("DoD.ui.character-sheet.age")),
      );
      table = await this.selectTable(ageTables, "Age");
    }
    if(type === "weakness" || type === "gear" || type === "memento"){
      const uuid = target.dataset.uuid;
      table = await fromUuid(uuid);
    }

    if (!table) return;

    const result = await table.draw();

    if (!result?.results?.length) return;

    const value = result.results[0].description;

    switch (type) {
      case "name":
        this._state.name = value;
        break;

      case "age":
        let rolledAge;
        switch (value.toLowerCase()) {
          case game.i18n.localize("DoD.ageTypes.young").toLowerCase():
            rolledAge = "young";
            this._state.numberOfSelectedSkills = 2;
            break;
          case game.i18n.localize("DoD.ageTypes.adult").toLowerCase():
            rolledAge = "adult";
            this._state.numberOfSelectedSkills = 4; 
            break;
          case game.i18n.localize("DoD.ageTypes.old").toLowerCase():
            rolledAge = "old";
            this._state.numberOfSelectedSkills = 6;
            break;
        }
        this._state.age = rolledAge;
        break;
      case "weakness":
        this._state.weakness = value;
        break;
      case "memento":
        this._state.memento = result.results[0].documentUuid;
        break;
      case "gear":
        const gear = result.results[0].range.join("-");
        this._state.gear = gear;
        break;

    }

    this.render({ force: true });
  }

  async selectTable(tables, targetName) {
    let selectedTable = null;

    if (tables.length > 0) {
      const result = await foundry.applications.api.DialogV2.wait({
        window: {
          title: game.i18n.localize("DoD.characterCreation.selectTable"),
        },
        content: `
                <p>
                    ${game.i18n.format("DoD.characterCreation.tableFound", {
                      kin: targetName,
                    })}
                </p>

                <ul>
                    ${tables.map((t) => `<li>${t.name}</li>`).join("")}
                </ul>
            `,
        buttons: [
          {
            action: "ok",
            label: game.i18n.localize("DoD.characterCreation.ok"),
            default: true,
          },
          {
            action: "cancel",
            label: game.i18n.localize("DoD.characterCreation.cancel"),
          },
        ],
      });

      if (result === "ok") {
        selectedTable = tables[0];
      }
    } else {
      const options = game.tables.contents
        .map(
          (table) =>
            `<option value="${table.id}">
                ${table.name}
            </option>`,
        )
        .join("");

      const result = await foundry.applications.api.DialogV2.wait({
        window: {
          title: game.i18n.localize("DoD.characterCreation.selectTable"),
        },

        content: `
                <p>
                    ${game.i18n.localize("DoD.characterCreation.noTableFound")}
                </p>

                <select id="table-select">
                    ${options}
                </select>
            `,

        buttons: [
          {
            action: "roll",
            label: game.i18n.localize("DoD.characterCreation.roll"),
            default: true,
          },
          {
            action: "cancel",
            label: game.i18n.localize("DoD.characterCreation.cancel"),
          },
        ],
      });

      if (result === "roll") {
        const select = document.querySelector("#table-select");
        selectedTable = game.tables.get(select.value);
      }
    }

    return selectedTable;
  }

  static async #changeTab(ev) {
    ev.preventDefault();

    const target = ev.target;
    const direction = Number(target.dataset.type);

    const tabs = [
      "kin",
      "profession",
      "age",
      "attributes",
      "skills",
      "weakness",
      "gear",
      "memento",
      "summary",
    ];

    const app = this;

    const currentTab = app.form.querySelector(".tab.active");
    const currentTabName = currentTab.dataset.tab;

    let index = tabs.indexOf(currentTabName);
    if (index === -1) index = 0;

    let nextIndex = index + direction;
    let nextTabName = tabs[nextIndex];
    const isGerTable = await this._prepareGearTable();
    const isMementTable = await this._prepareMementosTable();
    if((nextTabName === "gear" && isGerTable === "") || (nextTabName === "memento" && isMementTable === "")){
      nextIndex = index + 2*direction;
      nextTabName = tabs[nextIndex]
    }
    const nextTab = app.form.querySelector(`.tab[data-tab="${nextTabName}"]`);
    const previousButton = app.form.querySelector('button[data-type="-1"]');

    if (nextIndex > 0) {
      previousButton.disabled = false;
    } else {
      previousButton.disabled = true;
    }

    if (nextTabName === "age" && this._state.name.trim() === "") {
      const nextButton = app.form.querySelector('button[data-type="1"]');
      nextButton.disabled = true;
    }
    else{
      const nextButton = app.form.querySelector('button[data-type="1"]');
      if(nextButton){
        nextButton.disabled = false;
      }
    }

    if(currentTabName === "age"){
      const element = target.offsetParent;
      const ageSelect = element.querySelector('select[name="age"]');
      const value = ageSelect.value;
      let selectedAge = "";
      let numberOfSelectedSkills = 4;
       switch (value.toLowerCase()) {
          case "young":
            selectedAge = "young";
            numberOfSelectedSkills = 2;
            break;
          case "adult":
            selectedAge = "adult";
            numberOfSelectedSkills = 4;
            break;
          case "old":
            selectedAge = "old";
            numberOfSelectedSkills = 6;
            break;
        }
         this._state.age = selectedAge;
         this._state.numberOfSelectedSkills = numberOfSelectedSkills;
    }
    if(currentTabName === "skills"){
const selectedSkills = currentTab.querySelectorAll("input[type=checkbox]");

selectedSkills.forEach((checkbox) => {
  if (checkbox.checked) {
    const flexcol = checkbox.closest("div.flexcol");

    if (flexcol) {
      const skillName = flexcol.dataset.name; // if name is stored as data-name
      this._state.selectedSkills.push(skillName);
    }
  }
});
    }
if (currentTabName === "gear") {
    const gearTableUuid = await this._prepareGearTable();
    const gearTable = await fromUuid(gearTableUuid);

    let selectedRange = this._state.gear;
    if(selectedRange === ""){
        selectedRange = currentTab.querySelector(".selected-ger").value
    }
    const [selectedMin, selectedMax] = selectedRange
        .split("-")
        .map(Number);

    const descriptions = gearTable.results
        .filter(result => {
            const [resultMin, resultMax] = result.range;

            return (
                selectedMin >= resultMin &&
                selectedMax <= resultMax
            );
        })
        .map(result => result.description);

    this._state.selectedGear = descriptions[0];
}
    this._state.activeTab = nextTabName;
    currentTab.classList.remove("active");
    nextTab.classList.add("active");
    this.render()
  }

  static #resetAttributes(ev) {
    this._state.attributes = {
      str: 0,
      con: 0,
      agl: 0,
      int: 0,
      wil: 0,
      cha: 0,
    };
    this._state.allRolled = false;
    this._state.swapAttr = false;
    this.render({ force: true });
  }

  static async #rollAttributes(ev) {
    const availableAttributes = Object.entries(this._state.attributes)
      .filter(([_, value]) => value === 0)
      .map(([key]) => key);

    if (!availableAttributes.length) {
      this._state.allRolled = true;
      this.render({ force: true });
      return;
    }
    const roll = await new Roll("4d6kh3").roll();
    roll.toMessage();

    const rolledValue = roll.total;
    const optionsHtml = availableAttributes
      .map(
        (attr) => `
            <option value="${attr}">
                ${game.i18n.localize(`DoD.attributes.${attr}`)}
            </option>
        `,
      )
      .join("");

    new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize("DoD.characterCreation.assigneAttribues"),
      },

      content: `
            <div>
                <p>
                    ${game.i18n.localize("DoD.characterCreation.rolledValue")}
                    <strong>${rolledValue}</strong>
                </p>

                <div class="form-group">
                    <label>
                        ${game.i18n.localize("DoD.characterCreation.chooseAttribute")}
                    </label>

                    <select name="attribute">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
        `,

      buttons: [
        {
          action: "assign",
          label: game.i18n.localize("DoD.characterCreation.assign"),
          callback: (event, button, dialog) => {
            const attribute = dialog.element.querySelector(
              "select[name='attribute']",
            ).value;

            this._state.attributes[attribute] = rolledValue;
            const availableAttributes = Object.entries(this._state.attributes)
              .filter(([_, value]) => value === 0)
              .map(([key]) => key);

            if (!availableAttributes.length) {
              this._state.allRolled = true;
            }
            this.render();
          },
        },

        {
          action: "cancel",
          label: game.i18n.localize("DoD.characterCreation.cancel"),
        },
      ],
    }).render(true);
    
  }
  static #swapValues(ev) {
    const target = ev.target;

    const container = target.closest(".attribute-swap");

    const swap1 = container.querySelector('select[data-type="1"]');
    const swap2 = container.querySelector('select[data-type="2"]');

    const attr1 = swap1.value;
    const attr2 = swap2.value;

    const atrValue1 = this._state.attributes[attr1];
    const atrValue2 = this._state.attributes[attr2];

    this._state.attributes[attr1] = atrValue2;
    this._state.attributes[attr2] = atrValue1;
    this._state.swapAttr = true;
    this.render({ force: true });
  }


}
