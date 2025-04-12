// color palette
const BZ_COLOR = {
    // game colors
    silver: "#4c5366",  // = primary
    bronze: "#e5d2ac",  // = secondary
    primary: "#4c5366",
    secondary: "#e5d2ac",
    accent: "#616266",
    accent1: "#e5e5e5",
    accent2: "#c2c4cc",
    accent3: "#9da0a6",
    accent4: "#85878c",
    accent5: "#616266",
    accent6: "#05070d",
    // alert colors
    black: "#000000",
    danger: "#af1b1c99",  // danger = militaristic 60% opacity
    caution: "#cea92f",  // caution = healthbar-medium
    note: "#ff800033",  // note = orange 20% opacity
    // geographic colors
    hill: "#ff800033",  // Rough terrain = orange 20% opacity
    vegetated: "#aaff0033",  // Vegetated features = green 20% opacity
    wet: "#55aaff66",  // Wet features = teal 60% opacity
    road: "#e5d2accc",  // Roads & Railroads = bronze 80% opacity
    // yield types
    food: "#80b34d",        //  90°  40 50 green
    production: "#a33d29",  //  10°  60 40 red
    gold: "#f6ce55",        //  45°  90 65 yellow
    science: "#6ca6e0",     // 210°  65 65 cyan
    culture: "#5c5cd6",     // 240°  60 60 violet
    happiness: "#f5993d",   //  30°  90 60 orange
    diplomacy: "#afb7cf",   // 225°  25 75 gray
    // independent power types
    militaristic: "#af1b1c",
    scientific: "#4d7c96",
    economic: "#ffd553",
    cultural: "#892bb3",
    // relationship ring colors
    friendly: "#e5d2ac",
    hostile: "#af1b1c",
    neutral: "#e0b96c",     //  40°  65 65 deep bronze
    // highlight & shadow colors
    light: "#fff6e5cc",     //  40° 100 95 pale bronze
    shadow: "#00000080",
    progress: "#e0b96c",    //  40°  65 65 deep bronze
    celebration: "#e8d37d", //  48°  70 70 gold
};

const BZ_HEAD_STYLE = [
`
.gov.bz-celebration .ssb__button-iconbg {
    filter: brightness(2) fxs-color-tint(${BZ_COLOR.celebration});
}
.gov.bz-ready .ssb__button-icon {
    top: -0.1111111111rem;
    left: -0.0138888889rem;
    width: 3rem;
    height: 3rem;
    background-image: url('blp:ntf_tradition_slot_unlocked_blk');
}
.resources.bz-ready .ssb__button-icon {
    top: -0.1111111111rem;
    left: -0.0138888889rem;
    width: 3rem;
    height: 3rem;
    background-image: url('blp:ntf_assign_new_res_blk');
}
`,
];
BZ_HEAD_STYLE.forEach((style) => {
    const e = document.createElement('style');
    e.textContent = style;
    document.head.appendChild(e);
});

export class bzSubSystemDock {
    static c_prototype;
    constructor(component) {
        this.component = component;
        component.bzComponent = this;
        this.Root = this.component.Root;
        this.patchPrototypes(this.component);
        this.cityInitializedListener = this.onCityInitialized.bind(this);
    }
    patchPrototypes(component) {
        const c_prototype = Object.getPrototypeOf(component);
        if (bzSubSystemDock.c_prototype == c_prototype) return;
        // patch component methods
        const proto = bzSubSystemDock.c_prototype = c_prototype;
        // afterInitialize
        const afterInitialize = this.afterInitialize;
        const onInitialize = proto.onInitialize;
        proto.onInitialize = function(...args) {
            const c_rv = onInitialize.apply(this, args);
            const after_rv = afterInitialize.apply(this.bzComponent, args);
            return after_rv ?? c_rv;
        }
        // afterUpdateButtonTimers
        const afterUpdateButtonTimers = this.afterUpdateButtonTimers;
        const updateButtonTimers = proto.updateButtonTimers;
        proto.updateButtonTimers = function(...args) {
            const c_rv = updateButtonTimers.apply(this, args);
            const after_rv = afterUpdateButtonTimers.apply(this.bzComponent, args);
            return after_rv ?? c_rv;
        }
    }
    afterInitialize() {
        this.policiesButton = this.component.policiesButton;
        this.resourcesButton = this.component.resourcesButton;
        this.updateButtonFilters();
    }
    afterUpdateButtonTimers() {
        this.updateButtonFilters();
    }
    updateButtonFilters() {
        const player = Players.get(GameContext.localPlayerID);
        if (this.policiesButton) {
            const isReady = player.Culture?.canSwapNormalTraditions ?? false;
            this.policiesButton.classList.toggle('bz-ready', isReady);
            const isCelebration = player.Happiness?.isInGoldenAge() ?? false;
            this.policiesButton.classList.toggle('bz-celebration', isCelebration);
        }
        if (this.resourcesButton) {
            const isReady = !(player.Resources?.isRessourceAssignmentLocked() ?? true);
            this.resourcesButton.classList.toggle('bz-ready', isReady);
        }
    }
    beforeAttach() { }
    afterAttach() {
        engine.on('CityInitialized', this.cityInitializedListener);
        engine.on('CultureNodeCompleted', this.onCivicCompleted, this);
    }
    beforeDetach() {
        engine.off('CityInitialized', this.cityInitializedListener);
        engine.off('CultureNodeCompleted', this.onCivicCompleted, this);
    }
    afterDetach() { }
    onAttributeChanged(_name, _prev, _next) { }
    onCityInitialized(data) {
        // update resources after building or conquering a settlement
        if (data.cityID.owner != GameContext.localPlayerID) return;
        this.updateButtonFilters();
    }
    onCivicCompleted(data) {
        // update policies after unlocking one
        if (data.player && data.player != GameContext.localPlayerID) return;
        this.updateButtonFilters();
    }
}
Controls.decorate('panel-sub-system-dock', (component) => new bzSubSystemDock(component));
