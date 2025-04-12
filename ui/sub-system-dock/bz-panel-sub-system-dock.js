// color palette
const BZ_COLOR = {
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
        this.cityInitializedListener = this.onCityInitialized.bind(this);
        this.patchPrototypes(this.component);
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
        engine.on('TraditionSlotsAdded', this.onPolicySlotsAdded, this);
    }
    beforeDetach() {
        engine.off('CityInitialized', this.cityInitializedListener);
        engine.off('CultureNodeCompleted', this.onCivicCompleted, this);
        engine.off('TraditionSlotsAdded', this.onPolicySlotsAdded, this);
    }
    afterDetach() { }
    onAttributeChanged(_name, _prev, _next) { }
    onCityInitialized(data) {
        // update resources after building or conquering a settlement
        if (data.cityID.owner != GameContext.localPlayerID) return;
        this.updateButtonFilters();
    }
    onCivicCompleted(data) {
        // update policies after completing a civic
        if (data.player && data.player != GameContext.localPlayerID) return;
        this.updateButtonFilters();
    }
    onPolicySlotsAdded(data) {
        // update policies after unlocking a new policy slot
        if (data.player && data.player != GameContext.localPlayerID) return;
        this.updateButtonFilters();
    }
}
Controls.decorate('panel-sub-system-dock', (component) => new bzSubSystemDock(component));
