/**
 * @file Policies Screen Model
 * @copyright 2020-2024, Firaxis Games
 * @description Handles all of the data for the policies screen
 */

import ContextManager from '/core/ui/context-manager/context-manager.js'

class PoliciesModel {
	private _myGovernment: GovernmentDefinition | null = null;
	private _activePolicies: TraditionDefinition[] = [];
	private _availablePolicies: TraditionDefinition[] = [];
	private _activeNormalPolicies: TraditionDefinition[] = [];
	private _availableNormalPolicies: TraditionDefinition[] = [];
	private _activeCrisisPolicies: TraditionDefinition[] = [];
	private _availableCrisisPolicies: TraditionDefinition[] = [];

	private _numSlots: number = 0;
	private _numNormalSlots: number = 0;
	private _numCrisisSlots: number = 0;

	private onUpdate?: (model: PoliciesModel) => void;

	private policyHotkeyListener = this.onPolicyHotkey.bind(this);

	get activePolicies(): TraditionDefinition[] {
		return this._activePolicies ?? [];
	}

	get availablePolicies(): TraditionDefinition[] {
		return this._availablePolicies ?? [];
	}

	get activeNormalPolicies(): TraditionDefinition[] {
		return this._activeNormalPolicies ?? [];
	}

	get availableNormalPolicies(): TraditionDefinition[] {
		return this._availableNormalPolicies ?? [];
	}

	get activeCrisisPolicies(): TraditionDefinition[] {
		return this._activeCrisisPolicies ?? [];
	}

	get availableCrisisPolicies(): TraditionDefinition[] {
		return this._availableCrisisPolicies ?? [];
	}

	get myGovernment(): GovernmentDefinition | null {
		return this._myGovernment;
	}

	get numSlots(): number {
		return this._numSlots;
	}

	get numNormalSlots(): number {
		return this._numNormalSlots;
	}

	get numCrisisSlots(): number {
		return this._numCrisisSlots;
	}

	constructor() {
		window.addEventListener('hotkey-open-traditions', this.policyHotkeyListener);
	}

	set updateCallback(callback: (model: PoliciesModel) => void) {
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

		const localPlayer: PlayerLibrary | null = Players.get(GameContext.localPlayerID);
		if (!localPlayer) {
			return;	// Exit if no local player.
		}
		const localPlayerCulture: PlayerCulture = localPlayer.Culture!;
		if (!localPlayerCulture) {
			console.error("model-policies: Local player culture is null!");
			return;
		}

		const localPlayerGovernmentType: GovernmentType = localPlayerCulture.getGovernmentType();
		const localPlayerGovernment = GameInfo.Governments.lookup(localPlayerGovernmentType);
		if (localPlayerGovernment) {
			this._myGovernment = localPlayerGovernment;
		}

		const unlockedPolicies: TraditionType[] = localPlayerCulture.getUnlockedTraditions();
		for (const policyTypeHash of unlockedPolicies) {
			const policyInfo: TraditionDefinition = GameInfo.Traditions.lookup(policyTypeHash)!;
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

		const activePolicies: TraditionType[] = localPlayerCulture.getActiveTraditions();
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

	private onPolicyHotkey() {
		if (ContextManager.isCurrentClass('screen-policies')) {
			ContextManager.pop('screen-policies');
		} else if (!ContextManager.hasInstanceOf('screen-pause-menu')) {
			ContextManager.push("screen-policies", { singleton: true, createMouseGuard: true });
		}
	}
}

const PoliciesData = new PoliciesModel();
engine.whenReady.then(() => {

	const updateModel = () => {
		engine.updateWholeModel(PoliciesData);
	}

	engine.createJSModel('g_Policies', PoliciesData);
	PoliciesData.updateCallback = updateModel;
});

export { PoliciesData as default };
