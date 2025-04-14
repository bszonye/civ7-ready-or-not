const BZ_COLOR = {
    celebration: "#cfba6a",
    ring: "#b5afa9",
};
const BZ_HEAD_STYLE = [
`
.bz-ready .ssb__button-icon {
    top: -0.1111111111rem;
    left: -0.0138888889rem;
    width: 3rem;
    height: 3rem;
}
.resources.bz-ready .ssb__button-icon {
    background-image: url('blp:ntf_assign_new_res_blk');
}
.bz-gov.bz-ready .ssb__button-icon {
    background-image: url('blp:ntf_tradition_slot_unlocked_blk');
}
.ssb__element.bz-gov {
    margin: 0.3333333333rem;
    margin-top: 0.5555555556rem;
}
.bz-celebration .ssb__button-iconbg.bz-gov {
    filter: brightness(2) fxs-color-tint(${BZ_COLOR.celebration});
}
.bz-gov .fxs-ring-meter__ring {
    width: 4.8888888889rem;
    height: 4.8888888889rem;
    top: -1.0277777778rem;
    left: -0.9166666667rem;
}
.ssb__element.bz-gov .fxs-ring-meter__ring-left,
.ssb__element.bz-gov .fxs-ring-meter__ring-right {
    background-image: url("fs://game/hud_age_circle_rad.png");
    filter: grayscale(1) brightness(1.5) fxs-color-tint(${BZ_COLOR.ring});
}
.ssb__element.bz-gov.bz-celebration .fxs-ring-meter__ring-left,
.ssb__element.bz-gov.bz-celebration .fxs-ring-meter__ring-right {
    filter: grayscale(1) brightness(2) fxs-color-tint(${BZ_COLOR.celebration});
}
.bz-gov .ssb__button-icon {
    background-image: url("fs://game/sub_govt.png");
}
.bz-gov .ssb-button__turn-counter {
    top: 2.6111111111rem;
    left: 0.7777777778rem;
    height: 1.3888888889rem;
    width: 1.4444444444rem;
    background-color: #0008;
    border-radius: 50% / 0 0 0.1666666667rem 0.1666666667rem;
    z-index: -1;
}
.bz-gov .ssb-button__turn-counter-content {
    margin-top: 0.1666666667rem;
}
.bz-gov.bz-celebration .ssb-button__turn-counter-content {
    color: ${BZ_COLOR.celebration};
    font-weight: 900;
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
        this.buttonContainer = null;
        this.policiesButton = null;
        this.govButton = null;
        this.govRing = null;
        this.govTurnCounter = null;
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
        this.buttonContainer = this.component.buttonContainer;
        this.policiesButton = this.component.policiesButton;
        this.resourcesButton = this.component.resourcesButton;
        const govElements = this.createRingButton({
            tooltip: "LOC_UI_VIEW_TRADITIONS",
            callback: this.component.onOpenPolicies.bind(this.component),
            class: ["ring-gov", "tut-traditions"],
            ringClass: "ssb__texture-ring",
            modifierClass: 'bz-gov',
            audio: "government",
            focusedAudio: "data-audio-focus-small"
        });
        this.govButton = govElements.button;
        this.govRing = govElements.ring;
        this.govTurnCounter = govElements.turnCounter;
        this.buttonContainer.replaceChild(this.govRing, this.component.policiesButton);
        // leave the new button disconnected to disable conflicting mods
        // this.component.policiesButton = this.govRing;
        this.updateGovButton();
        this.updateResourcesButton();
    }
    afterUpdateButtonTimers() {
        this.updateGovButton();
        this.updateResourcesButton();
    }
    createRingButton(buttonData) {
        const turnCounter = document.createElement("div");
        turnCounter.classList.add("ssb-button__turn-counter");
        turnCounter.setAttribute("data-tut-highlight", "founderHighlight");
        const turnCounterContent = document.createElement("div");
        turnCounterContent.classList.add("ssb-button__turn-counter-content", "font-title-sm");
        turnCounter.appendChild(turnCounterContent);
        const ringAndButton = {
            button: this.component.createButton(buttonData),
            ring: this.component.createRing(buttonData),
            turnCounter
        };
        ringAndButton.ring.appendChild(ringAndButton.button);
        ringAndButton.ring.appendChild(ringAndButton.turnCounter);
        if (buttonData.ringClass) {
            ringAndButton.ring.setAttribute("ring-class", buttonData.ringClass);
        }
        const highlightObj = document.createElement("div");
        highlightObj.classList.add("ssb-button__highlight", "absolute");
        highlightObj.setAttribute("data-tut-highlight", "founderHighlight");
        ringAndButton.button.appendChild(highlightObj);
        ringAndButton.ring.classList.add("ssb__element");
        return ringAndButton;
    }
    getCurrentGoldenAge(playerID) {
        const players = ReflectionArchives.getPlayers().getChildren();
        const player = players?.find(item => item.id.owner == playerID)?.getChildren();
        const happiness = player?.find(item => item.typeStr == "PlayerHappiness");
        let info = {};
        for (let i = 0; i < (happiness?.memberCount ?? 0); ++i) {
            const field = happiness.getMember(i).name;
            const value = happiness.getMemberValueString(i);
            info[field] = value;
        }
        if (info.m_bIsGoldenAgeChoiceRequired == "true") {
            return { Description: "LOC_NOTIFICATION_CHOOSE_GOLDEN_AGE_MESSAGE" };
        }
        return GameInfo.GoldenAges[parseInt(info.m_eCurrentGoldenAge)];
    }
    updateGovButton() {
        if (!this.govButton) return;  // not ready yet
        const player = Players.get(GameContext.localPlayerID);
        if (player == null) return; // autoplaying
        const isCelebration = player.Happiness?.isInGoldenAge() ?? false;
        this.govRing.classList.toggle('bz-celebration', isCelebration);
        const isReady = player.Culture?.canSwapNormalTraditions ?? false;
        this.govButton.classList.toggle('bz-ready', isReady);
        let turnsLeft = 0;
        let progress = 0;
        const tooltip = [];
        if (isCelebration) {
            const duration = player.Happiness.getGoldenAgeDuration();
            turnsLeft = player.Happiness.getGoldenAgeTurnsLeft();
            progress = (duration - turnsLeft) / duration;
            tooltip.push(Locale.compose("LOC_SUB_SYSTEM_TRADITIONS_TURNS_UNTIL_CELEBRATION_END", turnsLeft));
            const goldenAge = this.getCurrentGoldenAge(player.id);
            if (goldenAge) {
                const description = Locale.compose(goldenAge.Description, duration);
                tooltip.push(`[b]${description}[/b]`);
            }
            this.govButton.setAttribute("data-tooltip-content", tooltip.join('[n]'));
        }
        else {
            const happinessPerTurn = player.Stats.getNetYield(YieldTypes.YIELD_HAPPINESS) ?? -1;
            const nextGoldenAgeThreshold = player.Happiness.nextGoldenAgeThreshold;
            const happinessTotal = Math.ceil(player.Stats.getLifetimeYield(YieldTypes.YIELD_HAPPINESS)) ?? -1;
            if (happinessPerTurn <= 0 || happinessTotal < 0) {
                progress = turnsLeft = 0;
            } else {
                progress = happinessTotal / nextGoldenAgeThreshold;
                turnsLeft = Math.ceil((nextGoldenAgeThreshold - happinessTotal) / happinessPerTurn);
            }
            tooltip.push(Locale.compose("LOC_SUB_SYSTEM_TRADITIONS_TURNS_UNTIL_CELEBRATION_START", turnsLeft));
        }
        if (isReady) tooltip.push(' ', Locale.compose("LOC_UI_POLICIES_CAN_SWAP"));
        this.govButton.setAttribute("data-tooltip-content", tooltip.join('[n]'));
        this.component.updateTurnCounter(this.govTurnCounter, turnsLeft.toString());
        this.govRing.setAttribute('value', (progress * 100).toString());
    }
    updateResourcesButton() {
        const player = Players.get(GameContext.localPlayerID);
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
        this.updateResourcesButton();
    }
    onCivicCompleted(data) {
        // update policies after completing a civic
        if (data.player && data.player != GameContext.localPlayerID) return;
        this.updateGovButton();
    }
    onPolicySlotsAdded(data) {
        // update policies after unlocking a new policy slot
        if (data.player && data.player != GameContext.localPlayerID) return;
        this.updateGovButton();
    }
}
Controls.decorate('panel-sub-system-dock', (component) => new bzSubSystemDock(component));
