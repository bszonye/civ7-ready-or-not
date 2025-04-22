/**
 * @file Policies Screen Model
 * @copyright 2020-2024, Firaxis Games
 * @description Handles all of the data for the policies screen
 */
import ContextManager from '/core/ui/context-manager/context-manager.js';
class PoliciesModel {
    get activePolicies() {
        return this._activePolicies ?? [];
    }
    get availablePolicies() {
        return this._availablePolicies ?? [];
    }
    get activeNormalPolicies() {
        return this._activeNormalPolicies ?? [];
    }
    get availableNormalPolicies() {
        return this._availableNormalPolicies ?? [];
    }
    get activeCrisisPolicies() {
        return this._activeCrisisPolicies ?? [];
    }
    get availableCrisisPolicies() {
        return this._availableCrisisPolicies ?? [];
    }
    get myGovernment() {
        return this._myGovernment;
    }
    get numSlots() {
        return this._numSlots;
    }
    get numNormalSlots() {
        return this._numNormalSlots;
    }
    get numCrisisSlots() {
        return this._numCrisisSlots;
    }
    constructor() {
        this._myGovernment = null;
        this._activePolicies = [];
        this._availablePolicies = [];
        this._activeNormalPolicies = [];
        this._availableNormalPolicies = [];
        this._activeCrisisPolicies = [];
        this._availableCrisisPolicies = [];
        this._numSlots = 0;
        this._numNormalSlots = 0;
        this._numCrisisSlots = 0;
        this.policyHotkeyListener = this.onPolicyHotkey.bind(this);
        window.addEventListener('hotkey-open-traditions', this.policyHotkeyListener);
    }
    set updateCallback(callback) {
        this.onUpdate = callback;
    }
    update() {
        this._activePolicies = [];
        this._availablePolicies = [];
        this._activeNormalPolicies = [];
        this._availableNormalPolicies = [];
        this._activeCrisisPolicies = [];
        this._availableCrisisPolicies = [];
        this._myGovernment = null;
        const localPlayer = Players.get(GameContext.localPlayerID);
        if (!localPlayer) {
            return; // Exit if no local player.
        }
        const localPlayerCulture = localPlayer.Culture;
        if (!localPlayerCulture) {
            console.error("model-policies: Local player culture is null!");
            return;
        }
        const localPlayerGovernmentType = localPlayerCulture.getGovernmentType();
        const localPlayerGovernment = GameInfo.Governments.lookup(localPlayerGovernmentType);
        if (localPlayerGovernment) {
            this._myGovernment = localPlayerGovernment;
        }
        const unlockedPolicies = localPlayerCulture.getUnlockedTraditions();
        for (const policyTypeHash of unlockedPolicies) {
            const policyInfo = GameInfo.Traditions.lookup(policyTypeHash);
            if (policyInfo && !localPlayerCulture.isTraditionActive(policyTypeHash)) {
                if (policyInfo.IsCrisis) {
                    this._availableCrisisPolicies.push(policyInfo);
                }
                else {
                    this._availableNormalPolicies.push(policyInfo);
                }
                this._availablePolicies.push(policyInfo);
            }
        }
        const activePolicies = localPlayerCulture.getActiveTraditions();
        for (const policy of activePolicies) {
            const policyDef = GameInfo.Traditions.lookup(policy);
            if (policyDef) {
                this._activePolicies.push(policyDef);
                if (policyDef.IsCrisis) {
                    this._activeCrisisPolicies.push(policyDef);
                }
                else {
                    this._activeNormalPolicies.push(policyDef);
                }
            }
        }
        //TODO: Sort based on attributes?
        this._numSlots = localPlayerCulture.numTraditionSlots;
        this._numNormalSlots = localPlayerCulture.numNormalTraditionSlots;
        this._numCrisisSlots = localPlayerCulture.numCrisisTraditionSlots;
        this.onUpdate?.(this);
    }
    onPolicyHotkey() {
        if (ContextManager.isCurrentClass('screen-policies')) {
            ContextManager.pop('screen-policies');
        }
        else if (!ContextManager.hasInstanceOf('screen-pause-menu')) {
            ContextManager.push("screen-policies", { singleton: true, createMouseGuard: true });
        }
    }
}
const PoliciesData = new PoliciesModel();
engine.whenReady.then(() => {
    const updateModel = () => {
        engine.updateWholeModel(PoliciesData);
    };
    engine.createJSModel('g_Policies', PoliciesData);
    PoliciesData.updateCallback = updateModel;
});
export { PoliciesData as default };

//# sourceMappingURL=file:///base-standard/ui/policies/model-policies.js.map
