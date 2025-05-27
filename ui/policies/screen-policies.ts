/**
 * @file screen-policies.ts
 * @copyright 2020-2024, Firaxis Games
 * @description Interface for viewing and slotting policies
 */

import PoliciesData from './model-policies.js';
import Panel from '/core/ui/panel-support.js';
import { InputEngineEvent, InputEngineEventName, NavigateInputEvent, NavigateInputEventName } from '/core/ui/input/input-support.js';
import { MustGetElement } from '/core/ui/utilities/utilities-dom.js';
import { TabItem, TabSelectedEvent } from '/core/ui/components/fxs-tab-bar.js';
import { PolicyChooserNode, PolicyChooserItem, PolicyChooserItemIcon } from './policy-chooser-item.js';
import FocusManager from '/core/ui/input/focus-manager.js';
import { utils } from '/core/ui/graph-layout/utils.js';
import NavTray from '/core/ui/navigation-tray/model-navigation-tray.js';
import Databind from '/core/ui/utilities/utilities-core-databinding.js';
import { Audio } from '/core/ui/audio-base/audio-support.js';
import { Focus } from '/core/ui/input/focus-support.js';
import { Layout } from '/core/ui/utilities/utilities-layout.js';

export enum PolicyTabPlacement {
	NONE,
	OVERVIEW,
	POLICIES,
	CRISIS
}
export type PolicyTab = ReturnType<typeof getPolicyTabItems>[number];
const getPolicyTabItems = (numOpenNormalSlots: number, numOpenCrisisSlots: number) => {
	const overviewTab = {
		label: 'LOC_UI_POLICIES_OVERVIEW_TAB',
		id: 'policies-overview'
	} as const;
	const normalTab = {
		label: 'LOC_UI_POLICIES_POLICIES_TAB',
		id: 'policies-normal',
		icon: numOpenNormalSlots > 0 ? "dip_attribute_notif" : undefined,
		iconClass: "mt-1 size-14",
		iconText: numOpenNormalSlots.toString(),
		className: "flex-row-reverse"
	} as const;
	const crisisTab = {
		label: 'LOC_UI_POLICIES_CRISIS_TAB',
		id: 'policies-crisis',
		icon: numOpenCrisisSlots > 0 ? "dip_attribute_notif" : undefined,
		iconClass: "mt-1 size-14",
		iconText: numOpenCrisisSlots.toString(),
		className: "flex-row-reverse"
	} as const;

	if (Game.AgeProgressManager.isFinalAge || !Game.CrisisManager.isCrisisEnabled) {
		return [overviewTab, normalTab] as const satisfies ReadonlyArray<TabItem>;
	}
	else {
		return [overviewTab, normalTab, crisisTab] as const satisfies ReadonlyArray<TabItem>;
	}
}

export class ScreenPolicies extends Panel {
	private confirmButtonListener = this.onConfirm.bind(this);
	private navigateInputListener = this.onNavigateInput.bind(this);
	private engineInputListener = this.onEngineInput.bind(this);
	private onPolicyTabSelectedListener = this.onPolicyTabSelected.bind(this);

	private overviewWindow!: HTMLElement;
	private policiesWindow!: HTMLElement;
	private crisisWindow!: HTMLElement;

	private currentWindow: HTMLElement | null = null;
	private confirmButton!: HTMLElement;
	private confirmButtonContainer!: HTMLElement;

	private activeNormalPolicyScrollable!: HTMLElement;
	private activeCrisisPolicyScrollable!: HTMLElement;
	private availableNormalPolicyScrollable!: HTMLElement;
	private availableCrisisPolicyScrollable!: HTMLElement;

	private displayActiveNormalPolicies: TraditionDefinition[] = [];
	private displayActiveCrisisPolicies: TraditionDefinition[] = [];
	private displayAvailableNormalPolicies: TraditionDefinition[] = [];
	private displayAvailableCrisisPolicies: TraditionDefinition[] = [];

	private policiesToAdd: TraditionDefinition[] = [];
	private policiesToRemove: TraditionDefinition[] = [];

	private localPlayer: PlayerLibrary | null = null;
	private canSwapNormalPolicies: boolean = false;
	private canSwapCrisisPolicies: boolean = false;

	private maxNormalPoliciesOnOverview: number = 4;
	private maxCrisisPoliciesOnOverview: number = 2;

	private initialSetupDone: boolean = false;

	private crisisEventMarkers = [
		{
			progressLabelStr: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_BEGINS",
			progressLabelStrRange: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_BEGINS_RANGE",
			locStr: "LOC_UI_POLICIES_CRISIS_BEGINS",
			timelinePlacement: Game.CrisisManager.getCrisisStageTriggerPercent(0) / 100
		},
		{
			progressLabelStr: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_INTENSIFIES",
			progressLabelStrRange: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_INTENSIFIES_RANGE",
			locStr: "LOC_UI_POLICIES_CRISIS_INTENSIFIES",
			timelinePlacement: Game.CrisisManager.getCrisisStageTriggerPercent(1) / 100
		},
		{
			progressLabelStr: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_CULMINATES",
			progressLabelStrRange: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_CULMINATES_RANGE",
			locStr: "LOC_UI_POLICIES_CRISIS_CULMINATES",
			timelinePlacement: Game.CrisisManager.getCrisisStageTriggerPercent(2) / 100
		},
		{
			progressLabelStr: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_ENDS",
			progressLabelStrRange: "LOC_UI_POLICIES_TURNS_UNTIL_CRISIS_ENDS_RANGE",
			locStr: "LOC_UI_POLICIES_CRISIS_ENDS",
			timelinePlacement: Game.CrisisManager.getCrisisStageTriggerPercent(3) / 100
		}
	]
	onInitialize(): void {
		this.confirmButton = MustGetElement("fxs-hero-button", this.Root);
		this.confirmButton.setAttribute("data-audio-group-ref", "audio-policy-chooser");
		this.confirmButton.setAttribute("data-audio-activate-ref", "data-audio-policy-confirmed");
		this.confirmButtonContainer = MustGetElement(".policies__confirm-container", this.Root);
		this.overviewWindow = MustGetElement(".policies__overview", this.Root);
		this.policiesWindow = MustGetElement(".policies__policies", this.Root);
		this.crisisWindow = MustGetElement(".policies__crisis", this.Root);
		this.activeNormalPolicyScrollable = MustGetElement(".policies_policies-active-scrollable", this.Root);
		this.activeCrisisPolicyScrollable = MustGetElement(".policies_crisis-active-scrollable", this.Root);
		this.availableNormalPolicyScrollable = MustGetElement(".policies_policies-available-scrollable", this.Root);
		this.availableCrisisPolicyScrollable = MustGetElement(".policies_crisis-available-scrollable", this.Root);
		this.enableOpenSound = true;
		this.enableCloseSound = true;
		this.Root.setAttribute("data-audio-group-ref", "audio-policy-chooser");
	}

	onAttach() {
		super.onAttach();
		PoliciesData.update();

		const closeButton = MustGetElement("fxs-close-button", this.Root);
		closeButton.addEventListener('action-activate', () => {
			this.close();
		});

		this.localPlayer = Players.get(GameContext.localPlayerID);
		if (!this.localPlayer) {
			console.error("screen-policies: onAttach(): No local player!");
			return;
		}
		this.confirmButton.addEventListener('action-activate', this.confirmButtonListener);
		this.Root.addEventListener(NavigateInputEventName, this.navigateInputListener);

		this.Root.addEventListener(InputEngineEventName, this.engineInputListener);

		this.displayAvailableNormalPolicies = PoliciesData.availableNormalPolicies;
		this.displayActiveNormalPolicies = PoliciesData.activeNormalPolicies;

		this.displayAvailableCrisisPolicies = PoliciesData.availableCrisisPolicies;
		this.displayActiveCrisisPolicies = PoliciesData.activeCrisisPolicies;

		const tabsContainer = MustGetElement("fxs-tab-bar", this.Root);

		const numOpenNormalSlots: number = this.hasNormalPolicies() ? this.getNumOpenNormalSlots() : 0;
		const numOpenCrisisSlots: number = this.hasCrisisPolicies() ? this.getNumOpenCrisisSlots() : 0;
		const policyTabItems = getPolicyTabItems(numOpenNormalSlots, numOpenCrisisSlots);

		tabsContainer.setAttribute("tab-items", JSON.stringify(policyTabItems));

		const playerCulture: PlayerCulture | undefined = this.localPlayer.Culture;
		if (!playerCulture) {
			console.error("screen-policies: onAttach() - local player had no culture!");
			return;
		}

		this.canSwapNormalPolicies = playerCulture.canSwapNormalTraditions;
		this.canSwapCrisisPolicies = playerCulture.canSwapCrisisTraditions;

		this.buildOverviewWindow();
		this.buildPolicyWindow();
		this.buildCrisisWindow();

		Databind.classToggle(this.confirmButtonContainer, 'hidden', `g_NavTray.isTrayRequired`);
	}

	onDetach() {
		this.Root.removeEventListener(InputEngineEventName, this.engineInputListener);
		this.Root.removeEventListener(NavigateInputEventName, this.navigateInputListener);
		this.confirmButton.removeEventListener('action-activate', this.confirmButtonListener);
		super.onDetach();
	}

	onReceiveFocus() {
		super.onReceiveFocus();

		NavTray.clear();
		NavTray.addOrUpdateGenericBack();

		if (!this.shouldDisableConfirmButton()) {
			NavTray.addOrUpdateShellAction1("LOC_UI_RESOURCE_ALLOCATION_CONFIRM");
		}

		if (this.initialSetupDone) {
			switch (this.currentWindow) {
				case this.overviewWindow:
					this.focusOverviewWindow();
					break;
				case this.policiesWindow:
					this.focusPoliciesWindow();
					break;
				case this.crisisWindow:
					this.focusCrisisWindow();
					break;
				default:
					break;
			}
		}
		else {
			const tabsContainer = MustGetElement("fxs-tab-bar", this.Root);
			if (this.canSwapNormalPolicies) {
				this.goToNewWindow(this.policiesWindow);
				tabsContainer.setAttribute("selected-tab-index", "1");
			}
			else if (this.canSwapCrisisPolicies) {
				this.goToNewWindow(this.crisisWindow);
				tabsContainer.setAttribute("selected-tab-index", "2");
			}
			else {
				this.goToNewWindow(this.overviewWindow);
			}
			this.initialSetupDone = true;
		}
		const tabsContainer = MustGetElement("fxs-tab-bar", this.Root);
		tabsContainer.addEventListener("tab-selected", this.onPolicyTabSelectedListener);
	}

	private focusOverviewWindow() {
		this.refreshOverviewPolicies()
		FocusManager.setFocus(MustGetElement(".policies__overview-normal-section", this.overviewWindow));
		this.confirmButton.classList.add("hidden");
	}

	private focusPoliciesWindow() {
		this.refreshPolicyWindow();
		if (this.displayAvailableNormalPolicies.length > 0) {
			this.focusAvailablePolicyContainer();
		}
		else if (this.displayActiveNormalPolicies.length > 0) {
			this.focusActivePolicyContainer();
		}
		this.confirmButton.classList.toggle("hidden", !(this.canSwapNormalPolicies && this.hasNormalPolicies()));
	}

	private focusCrisisWindow() {
		this.refreshCrisisWindow();
		if (this.displayAvailableCrisisPolicies.length > 0) {
			this.focusAvailableCrisisContainer();
		}
		else if (this.displayActiveCrisisPolicies.length > 0) {
			this.focusActiveCrisisContainer();
		}
		this.confirmButton.classList.toggle("hidden", !(this.canSwapCrisisPolicies && this.hasCrisisPolicies()));
	}

	setPanelOptions(panelOptions: any) {
		if (panelOptions.openTab) {
			const tabsContainer = MustGetElement("fxs-tab-bar", this.Root);
			switch (panelOptions.openTab) {
				case PolicyTabPlacement.OVERVIEW:
					this.goToNewWindow(this.overviewWindow);
					tabsContainer.setAttribute("selected-tab-index", "0");
					break;
				case PolicyTabPlacement.POLICIES:
					this.goToNewWindow(this.policiesWindow);
					tabsContainer.setAttribute("selected-tab-index", "1");
					break;
				case PolicyTabPlacement.CRISIS:
					this.goToNewWindow(this.crisisWindow);
					tabsContainer.setAttribute("selected-tab-index", "2");
					break;
				default:
					break;
			}
		}
	}

	private onPolicyTabSelected(e: TabSelectedEvent<PolicyTab>) {
		switch (e.detail.selectedItem.id) {
			case "policies-overview":
				this.goToNewWindow(this.overviewWindow);
				break;
			case "policies-normal":
				this.goToNewWindow(this.policiesWindow);
				break;
			case "policies-crisis":
				this.goToNewWindow(this.crisisWindow);
				break;
			default:
				e.detail.selectedItem satisfies never;
				break;
		}
	}

	private goToNewWindow(window: HTMLElement) {
		if (this.currentWindow) {
			this.currentWindow.classList.add("hidden");
		}
		this.currentWindow = window;
		this.currentWindow.classList.remove("hidden");
		if (window == this.overviewWindow) {
			this.focusOverviewWindow();
		}
		else if (window == this.policiesWindow) {
			this.focusPoliciesWindow();
		}
		else if (window == this.crisisWindow) {
			this.focusCrisisWindow();
		}
	}

	private buildOverviewWindow() {
		const currentGovernment: GovernmentDefinition | null = PoliciesData.myGovernment;

		const governmentNameElement = MustGetElement(".policies__overview-gov-name", this.overviewWindow);
		const governmentDescElement = MustGetElement(".policies__overview-gov-desc", this.overviewWindow);
		const happinessPerTurnElement = MustGetElement(".policies__happiness-per-turn", this.overviewWindow);
		const governmentBonusesContainer = MustGetElement(".policies__overview-gov-bonuses", this.overviewWindow);
		const celebrationTurnsLeftDesc = MustGetElement(".policies__overview-turns-left-desc", this.overviewWindow);
		const celebrationTurnsLeftNumber = MustGetElement(".policies__overview-turns-left-number", this.overviewWindow);
		const happinessRingMeter = MustGetElement(".policies__overview-happiness-meter", this.overviewWindow);
		const activeNormalPolicyContainer = MustGetElement(".policies__overview-policies-container", this.overviewWindow);
		const activeCrisisPolicyContainer = MustGetElement(".policies__overview-crisis-container", this.overviewWindow);
		const policySection = MustGetElement(".policies__overview-normal-section", this.overviewWindow);
		const crisisSection = MustGetElement(".policies__overview-crisis-section", this.overviewWindow);

		const localPlayerHappiness: PlayerHappiness | undefined = this.localPlayer?.Happiness;
		if (localPlayerHappiness === undefined) {
			console.error("screen-policies: buildOverviewWindow() - Local player happiness is undefined!");
			return;
		}

		const localPlayerStats: PlayerStats | undefined = this.localPlayer?.Stats;
		if (localPlayerStats === undefined) {
			console.error("screen-policies: buildOverviewWindow() - Local player stats is undefined!");
			return;
		}

		const localPlayerCulture: PlayerCulture | undefined = this.localPlayer?.Culture;
		if (!localPlayerCulture) {
			console.error("screen-policies: buildOverviewWindow() - No player culture!");
			return;
		}

		if (currentGovernment) {
			governmentNameElement.setAttribute("data-l10n-id", currentGovernment.Name);
			governmentDescElement.setAttribute("data-l10n-id", currentGovernment.Description ?? "ErrorDescription");
		}
		else {
			governmentNameElement.setAttribute("data-l10n-id", "LOC_UI_POLICIES_NO_GOVERNMENT_TITLE");
			governmentDescElement.setAttribute("data-l10n-id", "LOC_UI_POLICIES_NO_GOVERNMENT_DESC");
		}

		const happinessPerTurn: number = localPlayerStats.getNetYield(YieldTypes.YIELD_HAPPINESS) ?? -1;
		happinessPerTurnElement.innerHTML = Locale.stylize("LOC_UI_POLICIES_HAPPINESS_PER_TURN", `${(happinessPerTurn >= 0 ? "+" : "-")}${Math.round(happinessPerTurn)}`);

		const choices: string[] = localPlayerCulture.getGoldenAgeChoices();
		for (const choice of choices) {
			const celebrationItemDef: GoldenAgeDefinition | null = GameInfo.GoldenAges.lookup(choice);
			if (!celebrationItemDef) {
				console.error(`screen-policies: buildOverviewWindow() - No golden age definition found for ${choice}!`);
				return;
			}

			const celebrationChoiceContainer = document.createElement("div");
			celebrationChoiceContainer.classList.value = "flex items-center my-4";
			governmentBonusesContainer.appendChild(celebrationChoiceContainer);

			const celebrationChoiceImage = document.createElement("div");
			celebrationChoiceImage.classList.value = "size-8 bg-no-repeat bg-contain bg-center mr-3";
			celebrationChoiceImage.style.backgroundImage = `url("${UI.getIconURL(celebrationItemDef.GoldenAgeType)}")`
			celebrationChoiceContainer.appendChild(celebrationChoiceImage);

			const celebrationChoiceDesc = document.createElement("div");
			celebrationChoiceDesc.classList.value = "font-body-base";
			celebrationChoiceDesc.innerHTML = Locale.stylize(celebrationItemDef.Description, localPlayerHappiness.getGoldenAgeDuration());
			celebrationChoiceContainer.appendChild(celebrationChoiceDesc);
		}

		celebrationTurnsLeftDesc.setAttribute("data-l10n-id", localPlayerHappiness.isInGoldenAge() ? "LOC_UI_CURRENT_CELEBRATION" : "LOC_UI_NEXT_CELEBRATION");

		if (localPlayerHappiness.isInGoldenAge()) {
			celebrationTurnsLeftNumber.textContent = Locale.compose("LOC_UI_X_TURNS_LEFT", localPlayerHappiness.getGoldenAgeTurnsLeft());
			happinessRingMeter.setAttribute("value", (localPlayerHappiness.getGoldenAgeTurnsLeft() / localPlayerHappiness.getGoldenAgeDuration() * 100).toString());
		}
		else {
			const happinessPerTurn: number = localPlayerStats.getNetYield(YieldTypes.YIELD_HAPPINESS) ?? -1;
			const nextCelebrationThreshold: number = localPlayerHappiness.nextGoldenAgeThreshold;
			const happinessTotal: number = Math.ceil(localPlayerStats.getLifetimeYield(YieldTypes.YIELD_HAPPINESS)) ?? -1;
			const turnsToNextCelebration: number = Math.max(Math.ceil((nextCelebrationThreshold - happinessTotal) / happinessPerTurn), 1);
			celebrationTurnsLeftNumber.textContent = Locale.compose("LOC_UI_X_TURNS_LEFT", turnsToNextCelebration);
			happinessRingMeter.setAttribute("value", (100 * happinessTotal / nextCelebrationThreshold).toString());

		}

		this.maxNormalPoliciesOnOverview = (this.displayActiveCrisisPolicies.length > 0) ? 4 : 6;

		let index: number = 0;
		if (this.displayActiveNormalPolicies.length == 0) {
			policySection.classList.add("hidden");
		}
		for (const policy of PoliciesData.activeNormalPolicies) {
			if (this.maxNormalPoliciesOnOverview <= index) {
				activeNormalPolicyContainer.lastChild!.appendChild(this.createXYShownElement(this.maxNormalPoliciesOnOverview, PoliciesData.activeNormalPolicies.length));
				break;
			}
			const policyCard: HTMLElement = this.createPolicyCard(policy, false);
			activeNormalPolicyContainer.appendChild(policyCard);
			index++;
		}

		if (this.displayActiveCrisisPolicies.length == 0) {
			crisisSection.classList.add("hidden");
		}
		else {
			index = 0;
			for (const policy of PoliciesData.activeCrisisPolicies) {
				if (this.maxCrisisPoliciesOnOverview <= index) {
					activeCrisisPolicyContainer.lastChild!.appendChild(this.createXYShownElement(this.maxCrisisPoliciesOnOverview, PoliciesData.activeCrisisPolicies.length));
					break;
				}
				const policyCard: HTMLElement = this.createPolicyCard(policy, false);
				activeCrisisPolicyContainer.appendChild(policyCard);
				index++;
			}
		}
	}

	private buildPolicyWindow() {
		const header = MustGetElement(".policies__policies-unlock-text-header", this.policiesWindow);
		const subheader = MustGetElement(".policies__policies-unlock-text-subheader", this.policiesWindow);

		if (!this.hasNormalPolicies()) {
			const unlockText = MustGetElement(".policies__policies-unlock-text", this.policiesWindow);
			const allPoliciesContainer = MustGetElement(".policies__policies-all-container", this.policiesWindow);
			allPoliciesContainer.classList.add("hidden");
			header.setAttribute("title", "LOC_UI_POLICIES_NO_SLOTS_HEADER");

			const localPlayerStats: PlayerStats | undefined = this.localPlayer?.Stats;
			if (localPlayerStats === undefined) {
				console.error("screen-policies: buildPolicyWindow() - Local player stats is undefined!");
				return;
			}

			const localPlayerHappiness: PlayerHappiness | undefined = this.localPlayer?.Happiness;
			if (localPlayerHappiness === undefined) {
				console.error("screen-policies: buildPolicyWindow() - Local player happiness is undefined!");
				return;
			}

			const happinessPerTurn: number = localPlayerStats.getNetYield(YieldTypes.YIELD_HAPPINESS) ?? -1;
			const nextCelebrationThreshold: number = localPlayerHappiness.nextGoldenAgeThreshold;
			const happinessTotal: number = Math.ceil(localPlayerStats.getLifetimeYield(YieldTypes.YIELD_HAPPINESS)) ?? -1;
			const turnsToNextCelebration: number = Math.ceil((nextCelebrationThreshold - happinessTotal) / happinessPerTurn);
			subheader.textContent = Locale.compose("LOC_UI_POLICIES_NO_SLOTS_SUBHEADER", turnsToNextCelebration);
			unlockText.classList.remove("hidden");
			return;
		}

		else if (this.canSwapNormalPolicies) {
			const localPlayerAdvancedStart: PlayerAdvancedStart | undefined = this.localPlayer?.AdvancedStart;
			if (!localPlayerAdvancedStart) {
				console.error("screen-policies: buildPolicyWindow() - Local player asvanced start is undefined!");
				return;
			}
			const unlockText = MustGetElement(".policies__policies-unlock-text", this.policiesWindow);
			unlockText.classList.remove("hidden");
			const hasOpenNormalSlots: boolean = this.getNumOpenNormalSlots() > 0;
			if (this.displayAvailableNormalPolicies.length == 0 && hasOpenNormalSlots && localPlayerAdvancedStart.getPlacementComplete()) {
				subheader.setAttribute("data-l10n-id", "LOC_UI_POLICIES_NEW_POLICY_SLOT_CANT_FILL");
			}
			else {
				subheader.setAttribute("data-l10n-id", "LOC_UI_POLICIES_MAY_CHANGE");
			}
		}
		else {
			const arrowContainer = MustGetElement(".policies-arrow-container", this.policiesWindow);
			arrowContainer.classList.add("opacity-0");
		}

		this.refreshPolicyWindow();
	}

	private refreshPolicyWindow() {
		this.populateAvailableNormalPolicies();
		this.populateActiveNormalPolicies();
		this.setCardHeight(PolicyTabPlacement.POLICIES);

		const confirmDisabled: boolean = this.shouldDisableConfirmButton();
		this.confirmButton.setAttribute("disabled", confirmDisabled.toString());
		if (confirmDisabled) {
			this.confirmButton.setAttribute("data-tooltip-content", "LOC_UI_POLICIES_CONFIRM_DISABLED_TOOLTIP");
			NavTray.removeShellAction1();
		}
		else {
			this.confirmButton.removeAttribute("data-tooltip-content");
			NavTray.addOrUpdateShellAction1("LOC_UI_RESOURCE_ALLOCATION_CONFIRM");
		}
	}
	private refreshOverviewPolicies() {
		this.setCardHeight(PolicyTabPlacement.OVERVIEW);
		const activeNormalPolicyContainer = MustGetElement(".policies__overview-policies-container", this.overviewWindow);
		const crisisSection = MustGetElement(".policies__overview-crisis-section", this.overviewWindow);
		const activeCrisisPolicyContainer = MustGetElement(".policies__overview-crisis-container", this.overviewWindow);
		while (activeNormalPolicyContainer.hasChildNodes()) {
			activeNormalPolicyContainer.removeChild(activeNormalPolicyContainer.lastChild!);
		};
		while (activeCrisisPolicyContainer.hasChildNodes()) {
			activeCrisisPolicyContainer.removeChild(activeCrisisPolicyContainer.lastChild!);
		};

		let index: number = 0;
		for (const policy of PoliciesData.activeNormalPolicies) {
			if (this.maxNormalPoliciesOnOverview <= index) {
				activeNormalPolicyContainer.lastChild!.appendChild(this.createXYShownElement(this.maxNormalPoliciesOnOverview, PoliciesData.activeNormalPolicies.length));
				break;
			}
			const policyCard: HTMLElement = this.createPolicyCard(policy, false);
			activeNormalPolicyContainer.appendChild(policyCard);
			index++;
		}

		if (this.displayActiveCrisisPolicies.length == 0) {
			crisisSection.classList.add("hidden");
		}
		else {
			index = 0;
			for (const policy of PoliciesData.activeCrisisPolicies) {
				if (this.maxCrisisPoliciesOnOverview <= index) {
					activeCrisisPolicyContainer.lastChild!.appendChild(this.createXYShownElement(this.maxCrisisPoliciesOnOverview, PoliciesData.activeCrisisPolicies.length));
					break;
				}
				const policyCard: HTMLElement = this.createPolicyCard(policy, false);
				activeCrisisPolicyContainer.appendChild(policyCard);
				index++;
			}
		}
	}

	private buildCrisisWindow() {

		if (!(this.hasCrisisPolicies())) {
			const crisisPoliciesSection = MustGetElement(".policies__crisis-all-container", this.crisisWindow);
			crisisPoliciesSection.classList.add("hidden");
		}
		else {
			this.refreshCrisisWindow();
		}

		const innerProgressBar = MustGetElement(".policies__crisis-progress-bar-inner", this.crisisWindow);
		const markerContainer = MustGetElement(".policies__crisis-marker-container", this.crisisWindow);

		const currentAgeProgression = Game.AgeProgressManager.getCurrentAgeProgressionPoints() + 1;
		const maxAgeProgression = Game.AgeProgressManager.getMaxAgeProgressionPoints();
		const ageProgressionPercent = currentAgeProgression / maxAgeProgression;
		innerProgressBar.style.width = `${utils.clamp(ageProgressionPercent * 100, 0, 100)}%`;

		const crisisProgressText = MustGetElement(".policies__crisis-progress-text", this.crisisWindow);
		for (let i = 0; i < this.crisisEventMarkers.length; i++) {
			if (ageProgressionPercent < this.crisisEventMarkers[i].timelinePlacement) {
				break;
			}
		}

		const crisisStage = Game.CrisisManager.getCurrentCrisisStage();
		const nextCrisisStage = Math.max(0, crisisStage + 1);
		let showCrisisText = false;
		if (Game.CrisisManager.isCrisisEnabled && nextCrisisStage < this.crisisEventMarkers.length) {
			const { progressLabelStr, progressLabelStrRange } = this.crisisEventMarkers[nextCrisisStage];

			const minTurns = Game.CrisisManager.getMinimumTurnsRemainingInCurrentCrisis(crisisStage);
			const maxTurns = Game.CrisisManager.getMaximumTurnsRemainingInCurrentCrisis(crisisStage);
			if (minTurns != -1) {

				// If min is invalid or higher than max, collapse to a single value
				if (minTurns < 1) {
					crisisProgressText.innerHTML = Locale.stylize(progressLabelStr, maxTurns);
					showCrisisText = true;
				} else if (maxTurns < minTurns) {
					crisisProgressText.innerHTML = Locale.stylize(progressLabelStr, minTurns);
					showCrisisText = true;
				}
				// Otherwise show a range
				else {
					crisisProgressText.innerHTML = Locale.stylize(progressLabelStrRange, minTurns, maxTurns);
					showCrisisText = true;
				}
			}
		}

		crisisProgressText.classList.toggle("hidden", !showCrisisText);

		for (const crisisMarker of this.crisisEventMarkers) {
			const marker = document.createElement("div");
			marker.classList.value = `w-0\\.5 h-4 bg-primary text-center absolute bottom-0`;
			marker.style.right = `${(1 - crisisMarker.timelinePlacement) * 100}%`;

			const markerText = document.createElement("p");
			markerText.classList.value = "absolute min-w-20 max-w-25 bottom-4 font-title-2xs font-fit-shrink";
			markerText.setAttribute("data-l10n-id", crisisMarker.locStr);
			marker.appendChild(markerText);

			markerContainer.appendChild(marker);
		}

		if (!this.canSwapCrisisPolicies) {
			const arrowContainer = MustGetElement(".policies-arrow-container", this.crisisWindow);
			arrowContainer.classList.add("opacity-0");
		}
	}

	private refreshCrisisWindow() {
		this.populateAvailableCrisisPolicies();
		this.populateActiveCrisisPolicies();
		this.setCardHeight(PolicyTabPlacement.CRISIS);

		const confirmDisabled: boolean = this.shouldDisableConfirmButton();
		this.confirmButton.setAttribute("disabled", confirmDisabled.toString());
		if (confirmDisabled) {
			this.confirmButton.setAttribute("data-tooltip-content", "LOC_UI_POLICIES_CONFIRM_DISABLED_TOOLTIP");
			NavTray.removeShellAction1();
		}
		else {
			this.confirmButton.removeAttribute("data-tooltip-content");
			NavTray.addOrUpdateShellAction1("LOC_UI_RESOURCE_ALLOCATION_CONFIRM");
		}
	}

	private populateAvailableNormalPolicies() {
		const availableContainer = MustGetElement(".policies_policies-available-container", this.currentWindow);
		while (availableContainer.hasChildNodes()) {
			availableContainer.removeChild(availableContainer.lastChild!);
		};

		for (const availableNormalPolicy of this.displayAvailableNormalPolicies) {
			const policyCard: HTMLElement = this.createPolicyCard(availableNormalPolicy);
			policyCard.setAttribute("data-audio-activate-ref", "data-audio-social-policy-activate")
			policyCard.addEventListener('action-activate', () => {
				this.onAvailablePolicySelected(availableNormalPolicy);
			});
			availableContainer.appendChild(policyCard);
		}
	}

	private populateActiveNormalPolicies() {
		const activeContainer = MustGetElement(".policies_policies-active-container", this.currentWindow);
		while (activeContainer.hasChildNodes()) {
			activeContainer.removeChild(activeContainer.lastChild!);
		};

		for (const activeNormalPolicy of this.displayActiveNormalPolicies) {
			const policyCard: HTMLElement = this.createPolicyCard(activeNormalPolicy);
			policyCard.setAttribute("data-audio-activate-ref", "data-audio-social-policy-remove")
			policyCard.addEventListener('action-activate', () => {
				this.onActivePolicySelected(activeNormalPolicy);
			});
			activeContainer.appendChild(policyCard);
		}

		const numOpenNormalSlots: number = this.getNumOpenNormalSlots();
		for (let i = 0; i < numOpenNormalSlots; i++) {
			const openPolicyCard: HTMLElement = this.createEmptyNormalSlot();

			activeContainer.insertBefore(openPolicyCard, activeContainer.firstChild);

		}
	}

	private populateAvailableCrisisPolicies() {
		const availableContainer = MustGetElement(".policies_crisis-available-container", this.currentWindow);
		while (availableContainer.hasChildNodes()) {
			availableContainer.removeChild(availableContainer.lastChild!);
		};

		for (const availableCrisisPolicy of this.displayAvailableCrisisPolicies) {
			const policyCard: HTMLElement = this.createPolicyCard(availableCrisisPolicy);
			policyCard.setAttribute("data-audio-activate-ref", "data-audio-social-policy-activate")
			policyCard.addEventListener('action-activate', () => {
				this.onAvailablePolicySelected(availableCrisisPolicy);
			});
			availableContainer.appendChild(policyCard);
		}
	}

	private populateActiveCrisisPolicies() {
		const activeContainer = MustGetElement(".policies_crisis-active-container", this.currentWindow);
		while (activeContainer.hasChildNodes()) {
			activeContainer.removeChild(activeContainer.lastChild!);
		};

		for (const activeCrisisPolicy of this.displayActiveCrisisPolicies) {
			const policyCard: HTMLElement = this.createPolicyCard(activeCrisisPolicy);
			policyCard.setAttribute("data-audio-activate-ref", "data-audio-social-policy-remove")
			policyCard.addEventListener('action-activate', () => {
				this.onActivePolicySelected(activeCrisisPolicy);
			});
			activeContainer.appendChild(policyCard);
		}

		const numOpenCrisisSlots: number = this.getNumOpenCrisisSlots();
		for (let i = 0; i < numOpenCrisisSlots; i++) {
			const openPolicyCard: HTMLElement = this.createEmptyCrisisSlot();
			activeContainer.insertBefore(openPolicyCard, activeContainer.firstChild);
		}
	}

	private createPolicyCard(policy: TraditionDefinition, isSelectable: boolean = true): HTMLElement {
		const policyItem = document.createElement("policy-chooser-item") as ComponentRoot<PolicyChooserItem>;
		policyItem.setAttribute("data-audio-group-ref", "audio-policy-chooser");
		policyItem.setAttribute("data-audio-press-ref", "data-audio-policy-press");

		//determine if the card should play the error sounds or the standard sounds
		if (this.canSwapPolicy(policy)) {
			if (!(policy.IsCrisis) && PoliciesData.numNormalSlots == this.displayActiveNormalPolicies.length && !this.displayActiveNormalPolicies.includes(policy)) {
				policyItem.setAttribute("play-error-sound", "true");
			}
			else if (policy.IsCrisis && PoliciesData.numCrisisSlots == this.displayActiveCrisisPolicies.length && !this.displayActiveCrisisPolicies.includes(policy)) {
				policyItem.setAttribute("play-error-sound", "true");
			}
			else {
				policyItem.setAttribute("play-error-sound", "false");
			}
		}
		else {
			policyItem.setAttribute("play-error-sound", "true");
		}

		policyItem.componentCreatedEvent.on((chooser) => {
			chooser.policyChooserNode = this.createPolicyNode(policy, isSelectable);
		});
		return policyItem;
	}

	private createPolicyNode(policy: TraditionDefinition, isSelectable: boolean): PolicyChooserNode {
		let iconType: PolicyChooserItemIcon = PolicyChooserItemIcon.NONE;
		const playerCulture: PlayerCulture | undefined = this.localPlayer?.Culture;
		if (!playerCulture) {
			console.error("screen-policies: createPolicyNode() - no player culture found!");
		}
		else {
			const policyIdeology = playerCulture.getIdeologyForTradition(policy.TraditionType);
			switch (policyIdeology) {
				case Database.makeHash("IDEOLOGY_COMMUNISM"):
					iconType = PolicyChooserItemIcon.COMMUNISM;
					break;
				case Database.makeHash("IDEOLOGY_DEMOCRACY"):
					iconType = PolicyChooserItemIcon.DEMOCRACY;
					break;
				case Database.makeHash("IDEOLOGY_FASCISM"):
					iconType = PolicyChooserItemIcon.FASCISM;
					break;
				default:
					iconType = policy.TraitType ? PolicyChooserItemIcon.TRADITION : PolicyChooserItemIcon.NONE;
					break;
			}
		}

		return {
			name: Locale.compose(policy.Name),
			primaryIcon: "",
			description: Locale.stylize(policy.Description ?? ""),
			isCrisis: policy.IsCrisis,
			isPlaceable: this.canSwapPolicy(policy),
			isLocked: false,
			iconType: iconType,
			isSelectable: isSelectable,
			traitType: policy.TraitType ?? undefined,
		}
	}

	private createEmptyNormalSlot(): HTMLElement {
		if (window.innerHeight > Layout.pixelsToScreenPixels(768)) {
			const openPolicyCard = document.createElement("div");
			openPolicyCard.setAttribute("data-audio-group-ref", "policy-chooser");
			openPolicyCard.setAttribute("data-audio-focus", "social-policy-focus");
			openPolicyCard.classList.value = `policies-open-slot-normal policy-placeable policy-chooser-element m-2 bg-no-repeat bg-auto bg-center flex items-center justify-center`;

			const openPolicyCardText = document.createElement("div");
			openPolicyCardText.classList.value = "font-title-base max-w-48 text-center";
			openPolicyCardText.setAttribute("data-l10n-id", "LOC_UI_POLICIES_ADD_NORMAL_POLICY");
			openPolicyCard.appendChild(openPolicyCardText);
			return openPolicyCard;
		}
		else {
			const openPolicyCard = document.createElement("div");
			openPolicyCard.setAttribute("data-audio-group-ref", "policy-chooser");
			openPolicyCard.setAttribute("data-audio-focus", "social-policy-focus");
			openPolicyCard.classList.value = "policies-open-slot-wide_container policy-chooser-element w-full relative flex m-2 items-center justify-center";

			const openPolicyCardBG = document.createElement("div");
			openPolicyCardBG.classList.value = "size-full flex absolute";
			openPolicyCard.appendChild(openPolicyCardBG);

			const openPolicyCardBGLeft = document.createElement("div");
			openPolicyCardBGLeft.classList.value = "policies-open-slot-wide_half-bg h-full w-1\\/2";
			openPolicyCardBG.appendChild(openPolicyCardBGLeft);

			const openPolicyCardBGRight = document.createElement("div");
			openPolicyCardBGRight.classList.value = "policies-open-slot-wide_half-bg h-full w-1\\/2 -scale-x-100";
			openPolicyCardBG.appendChild(openPolicyCardBGRight);

			const openPolicyCardText = document.createElement("div");
			openPolicyCardText.classList.value = "font-title-base max-w-48 text-center relative";
			openPolicyCardText.setAttribute("data-l10n-id", "LOC_UI_POLICIES_ADD_NORMAL_POLICY");
			openPolicyCard.appendChild(openPolicyCardText);

			return openPolicyCard;
		}
	}

	private createEmptyCrisisSlot(): HTMLElement {
		const openPolicyCard = document.createElement("div");
		openPolicyCard.setAttribute("data-audio-group-ref", "policy-chooser");
		openPolicyCard.setAttribute("data-audio-focus", "social-policy-focus");
		if (window.innerHeight > Layout.pixelsToScreenPixels(768)) {
			openPolicyCard.classList.value = `policies-open-slot-crisis policy-placeable policy-chooser-element m-2 bg-no-repeat bg-auto bg-center flex items-center justify-center relative`;
		}
		else {
			openPolicyCard.classList.value = "policies-open-slot-wide_container w-full relative flex m-2 items-center justify-center";

			const openPolicyCardBG = document.createElement("div");
			openPolicyCardBG.classList.value = "size-full flex absolute";
			openPolicyCard.appendChild(openPolicyCardBG);

			const openPolicyCardBGLeft = document.createElement("div");
			openPolicyCardBGLeft.classList.value = "policies-open-slot-wide_half-bg h-full w-1\\/2";
			openPolicyCardBG.appendChild(openPolicyCardBGLeft);

			const openPolicyCardBGRight = document.createElement("div");
			openPolicyCardBGRight.classList.value = "policies-open-slot-wide_half-bg h-full w-1\\/2 -scale-x-100";
			openPolicyCardBG.appendChild(openPolicyCardBGRight);

			const openPolicyCardCrisisBorder = document.createElement("div");
			openPolicyCardCrisisBorder.classList.value = "border border-negative size-full absolute";
			openPolicyCard.appendChild(openPolicyCardCrisisBorder);
		}

		const openPolicyCardImageBG = document.createElement("div");
		openPolicyCardImageBG.classList.value = "absolute bg-center bg-contain bg-no-repeat size-2\\/3";
		openPolicyCardImageBG.style.backgroundImage = `url("civic_crisis_low_op")`;
		openPolicyCard.appendChild(openPolicyCardImageBG);

		const openPolicyCardText = document.createElement("div");
		openPolicyCardText.classList.value = "font-title-base max-w-48 text-center";
		openPolicyCardText.setAttribute("data-l10n-id", "LOC_UI_POLICIES_ADD_CRISIS_POLICY");
		openPolicyCard.appendChild(openPolicyCardText);

		return openPolicyCard;
	}

	private onAvailablePolicySelected(policy: TraditionDefinition) {
		if (!(policy.IsCrisis) && PoliciesData.numNormalSlots == this.displayActiveNormalPolicies.length) {
			return;
		}
		else if (policy.IsCrisis && PoliciesData.numCrisisSlots == this.displayActiveCrisisPolicies.length) {
			return;
		}

		if (this.policiesToRemove.includes(policy)) {
			const index: number = this.policiesToRemove.indexOf(policy);
			this.policiesToRemove.splice(index, 1);
		} else {
			this.policiesToAdd.push(policy);
		}

		if (policy.IsCrisis) {
			const index: number = this.displayAvailableCrisisPolicies.indexOf(policy);
			this.displayAvailableCrisisPolicies.splice(index, 1);
			this.displayActiveCrisisPolicies.unshift(policy);
			this.refreshCrisisWindow();

			if (this.displayAvailableCrisisPolicies.length == 0) {
				this.focusActiveCrisisContainer();
			}
		}
		else {
			const index: number = this.displayAvailableNormalPolicies.indexOf(policy);
			this.displayAvailableNormalPolicies.splice(index, 1);
			this.displayActiveNormalPolicies.unshift(policy);
			this.refreshPolicyWindow();

			if (this.displayAvailableNormalPolicies.length == 0) {
				this.focusActivePolicyContainer();
			}
		}
	}

	private onActivePolicySelected(policy: TraditionDefinition) {
		if (this.canSwapPolicy(policy)) {
			if (this.policiesToAdd.includes(policy)) {
				const index: number = this.policiesToAdd.indexOf(policy);
				this.policiesToAdd.splice(index, 1);
			} else {
				this.policiesToRemove.push(policy);
			}

			if (policy.IsCrisis) {
				const index: number = this.displayActiveCrisisPolicies.indexOf(policy);
				this.displayActiveCrisisPolicies.splice(index, 1);
				this.displayAvailableCrisisPolicies.unshift(policy);
				this.refreshCrisisWindow();

				if (this.displayActiveCrisisPolicies.length == 0) {
					this.focusAvailableCrisisContainer();
				}
			}
			else {
				const index: number = this.displayActiveNormalPolicies.indexOf(policy);
				this.displayActiveNormalPolicies.splice(index, 1);
				this.displayAvailableNormalPolicies.unshift(policy);
				this.refreshPolicyWindow();

				if (this.displayActiveNormalPolicies.length == 0) {
					this.focusAvailablePolicyContainer();
				}
			}
		}
	}

	protected onEngineInput(inputEvent: InputEngineEvent) {
		if (inputEvent.detail.status != InputActionStatuses.FINISH) {
			return;
		}

		if (inputEvent.isCancelInput() || inputEvent.detail.name == 'sys-menu') {
			this.close();
			inputEvent.stopPropagation();
			inputEvent.preventDefault();
		}
		if (inputEvent.detail.name == "shell-action-1") {
			if (!this.shouldDisableConfirmButton()) {
				this.onConfirm();
				inputEvent.stopPropagation();
				inputEvent.preventDefault();
				Audio.playSound("data-audio-policy-confirmed", "audio-policy-chooser");
			}
		}
	}

	private onNavigateInput(navigationEvent: NavigateInputEvent) {
		const direction: InputNavigationAction = navigationEvent.getDirection();
		switch (direction) {
			case InputNavigationAction.UP:
				if (FocusManager.getFocus().parentElement == MustGetElement(".policies__overview-crisis-container", this.overviewWindow)) {
					FocusManager.setFocus(MustGetElement(".policies__overview-policies-container", this.overviewWindow));
				}
				break;
			case InputNavigationAction.RIGHT:
				if (FocusManager.getFocus().parentElement == MustGetElement(".policies_policies-available-container", this.policiesWindow)
					&& this.displayActiveNormalPolicies.length > 0) {
					this.focusActivePolicyContainer();

				}
				else if (FocusManager.getFocus().parentElement == MustGetElement(".policies_crisis-available-container", this.crisisWindow)
					&& this.displayActiveCrisisPolicies.length > 0) {
					this.focusActiveCrisisContainer();
				}
				break;
			case InputNavigationAction.DOWN:
				if (FocusManager.getFocus().parentElement == MustGetElement(".policies__overview-policies-container", this.overviewWindow) && this.hasCrisisPolicies()) {
					FocusManager.setFocus(MustGetElement(".policies__overview-crisis-container", this.overviewWindow));
				}
				break;
			case InputNavigationAction.LEFT:
				if (FocusManager.getFocus().parentElement == MustGetElement(".policies_policies-active-container", this.policiesWindow)
					&& this.displayAvailableNormalPolicies.length > 0) {
					this.focusAvailablePolicyContainer();

				}
				else if (FocusManager.getFocus().parentElement == MustGetElement(".policies_crisis-active-container", this.crisisWindow)
					&& this.displayAvailableCrisisPolicies.length > 0) {
					this.focusAvailableCrisisContainer();
				}
				break;
			default:
				break;

		}
	}

	private focusAvailablePolicyContainer() {
		const availablePolicies = MustGetElement(".policies_policies-available-container", this.policiesWindow);
		Focus.setContextAwareFocus(availablePolicies, this.policiesWindow);
		this.activeNormalPolicyScrollable.removeAttribute("handle-gamepad-pan");
		this.availableNormalPolicyScrollable.setAttribute("handle-gamepad-pan", "true");
	}

	private focusActivePolicyContainer() {
		const activePolicies = MustGetElement(".policies_policies-active-container", this.policiesWindow);
		Focus.setContextAwareFocus(activePolicies, this.policiesWindow);
		this.availableNormalPolicyScrollable.removeAttribute("handle-gamepad-pan");
		this.activeNormalPolicyScrollable.setAttribute("handle-gamepad-pan", "true");
	}

	private focusAvailableCrisisContainer() {
		const availableCrisis = MustGetElement(".policies_crisis-available-container", this.crisisWindow);
		Focus.setContextAwareFocus(availableCrisis, this.crisisWindow);
		this.activeCrisisPolicyScrollable.removeAttribute("handle-gamepad-pan");
		this.availableCrisisPolicyScrollable.setAttribute("handle-gamepad-pan", "true");
	}

	private focusActiveCrisisContainer() {
		const activeCrisis = MustGetElement(".policies_crisis-active-container", this.crisisWindow);
		Focus.setContextAwareFocus(activeCrisis, this.crisisWindow);
		this.availableCrisisPolicyScrollable.removeAttribute("handle-gamepad-pan");
		this.activeCrisisPolicyScrollable.setAttribute("handle-gamepad-pan", "true");
	}

	private shouldDisableConfirmButton(): boolean {
		let normalSlotsFilled: boolean = false;
		let crisisSlotsFilled: boolean = false;
		if (this.getNumOpenNormalSlots() == 0 || this.displayAvailableNormalPolicies.length == 0) {
			normalSlotsFilled = true;
		}
		if (this.getNumOpenCrisisSlots() == 0 || this.displayAvailableCrisisPolicies.length == 0) {
			crisisSlotsFilled = true;
		}
		return !normalSlotsFilled && !crisisSlotsFilled;
	}

	private onConfirm() {
		this.applyNextPolicy();
	}
	private setCardHeight(section: PolicyTabPlacement): void {
		waitForLayout(() => {
			let currentSection: HTMLElement = this.Root;
			if (section == PolicyTabPlacement.OVERVIEW) {
				currentSection = this.overviewWindow;
			} if (section == PolicyTabPlacement.CRISIS) {
				currentSection = this.crisisWindow;
			} if (section == PolicyTabPlacement.POLICIES) {
				currentSection = this.policiesWindow;
			}
			const cardList = currentSection.querySelectorAll('.policy-chooser-element');
			let maxHeight = 0;
			for (let i = 0; i < cardList.length; i++) {
				const { height } = cardList[i].getBoundingClientRect();
				maxHeight = Math.max(maxHeight, height);
			}
			for (let i = 0; i < cardList.length; i++) {
				const card = cardList[i];
				if (card instanceof HTMLElement) {
					//this implementation breaks min-height, so here it is set manually						
					if (maxHeight > 125) {
						card.style.heightPX = maxHeight;
					}
					else {
						card.style.heightPX = 125;
					}
				}
			}
		})
	}

	private createXYShownElement(numerator: number, denominator: number): HTMLElement {
		const xyContainer = document.createElement("div");
		xyContainer.classList.value = "policies__overview-xy-container absolute -bottom-6 right-2";

		const xyContainerText = document.createElement("div");
		xyContainerText.classList.value = "flex p-2";
		xyContainer.appendChild(xyContainerText);

		const xyContainerTextFraction = document.createElement("div");
		xyContainerTextFraction.textContent = Locale.compose("LOC_UI_X_OVER_Y", numerator, denominator);
		xyContainerTextFraction.classList.value = "font-body-base mr-2";
		xyContainerText.appendChild(xyContainerTextFraction);

		const xyContainerTextShown = document.createElement("div");
		xyContainerTextShown.setAttribute("data-l10n-id", "LOC_UI_SHOWN");
		xyContainerTextShown.classList.value = "font-body-base text-accent-4";
		xyContainerText.appendChild(xyContainerTextShown);

		return xyContainer;
	}

	//TODO: Having to send multiple requests to make all the policy changes we want is really slow and really really bad.
	//TODO: Need a way to pass in both policiesToAdd and policiesToRemove and have all the swapping done in one request
	private applyNextPolicy() {
		if (this.policiesToRemove.length + this.policiesToAdd.length == 0) {
			this.close();
			return;
		}

		let policy: TraditionDefinition | undefined = undefined;
		let operationParameter: PlayerOperationParameters | null = null;

		if (this.policiesToRemove.length > 0) {
			policy = this.policiesToRemove.pop();
			operationParameter = PlayerOperationParameters.Deactivate;
		}
		else if (this.policiesToAdd.length > 0) {
			policy = this.policiesToAdd.pop();
			operationParameter = PlayerOperationParameters.Activate;
		}

		if (policy && operationParameter) {
			const args = {
				TraditionType: policy.$index,
				Action: operationParameter
			};
			const result = Game.PlayerOperations.canStart(GameContext.localPlayerID, PlayerOperationTypes.CHANGE_TRADITION, args, false);
			if (result.Success) {
				Game.PlayerOperations.sendRequest(GameContext.localPlayerID, PlayerOperationTypes.CHANGE_TRADITION, args);
				const eventHandle: EventHandle = engine.on('TraditionChanged', () => {
					this.applyNextPolicy();
					eventHandle.clear();
				});
			} else {
				console.error("screen-policies: applyNextPolicy(): Unable to successfully deactivate policy with index: ", policy.$index, " and type: ", policy.TraditionType);
			}
		}
		else {
			console.error("screen-policies: applyNextPolicy() - failed to start a tradition change operation!");
		}
	}

	private getNumOpenNormalSlots(): number {
		return PoliciesData.numNormalSlots - this.displayActiveNormalPolicies.length;
	}

	private getNumOpenCrisisSlots(): number {
		return PoliciesData.numCrisisSlots - this.displayActiveCrisisPolicies.length;
	}

	private hasNormalPolicies(): boolean {
		return this.displayActiveNormalPolicies.length + this.displayAvailableNormalPolicies.length != 0;
	}

	private hasCrisisPolicies(): boolean {
		return this.displayActiveCrisisPolicies.length + this.displayAvailableCrisisPolicies.length != 0;
	}

	private canSwapPolicy(policy: TraditionDefinition): boolean {
		return (policy.IsCrisis && this.canSwapCrisisPolicies) || (!policy.IsCrisis && this.canSwapNormalPolicies);
	}
}

Controls.define('screen-policies', {
	createInstance: ScreenPolicies,
	description: 'Screen for choosing policies and crisis policies',
	requires: ['fxs-button', 'fxs-close-button'],
	classNames: ['screen-policies', 'absolute', "flex", "items-center", "justify-center"],
	styles: ['fs://game/base-standard/ui/policies/screen-policies.css'],
	content: ['fs://game/base-standard/ui/policies/screen-policies.html'],
	tabIndex: -1
});

declare global {
	interface HTMLElementTagNameMap {
		"screen-policies": ComponentRoot<ScreenPolicies>,
	}
}