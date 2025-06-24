const BZ_HEAD_STYLE = [
`
.policies__overview-happiness-meter-circle  {
    position: relative;
    top: 0.0555555556rem;
    left: -0.0555555556rem;
}
.policies__overview-happiness-meter-image {
    position: relative;
    top: -0.0555555556rem;
    left: 0.0555555556rem;
}
`,
];
BZ_HEAD_STYLE.forEach((style) => {
    const e = document.createElement('style');
    e.textContent = style;
    document.head.appendChild(e);
});

export function getGoldenAgeThreshold(i) {
    // calculate player.Happiness.nextGoldenAgeThreshold values
    // NOTE: game values differ slightly because of rounding, see below
    if (i < 1) return 0;
    // get game parameters
    const { gameSpeedType } = Configuration.getGame();
    const gameSpeed = GameInfo.GameSpeeds.lookup(gameSpeedType);
    const speed = (gameSpeed?.CostMultiplier ?? 100) / 100;
    const k = parseInt(GlobalParameters.GOLDEN_AGE_PLATEAU_COUNT);
    const a = parseFloat(GlobalParameters.GOLDEN_AGE_HAPPINESS_CURVE_A);
    const b = parseFloat(GlobalParameters.GOLDEN_AGE_HAPPINESS_CURVE_B);
    const c = parseFloat(GlobalParameters.GOLDEN_AGE_HAPPINESS_CURVE_C);
    const d = parseFloat(GlobalParameters.GOLDEN_AGE_HAPPINESS_CURVE_D);
    // celebration thresholds follow a cubic curve, up to a plateau
    // t(i) = a*i^3 + b*i^2 + c*i + d, for i <= k
    const t = x => a * (x**3) + b * (x**2) + c * x + d;
    const s = x => Math.floor(x * speed);  // adjust for game speed
    if (i < k) return s(Math.round(t(i)));
    // threshold becomes linear, repeating the last cubic step
    const t0 = t(k);
    const dt = t0 - t(k-1);
    return s(Math.round(t0) + (i-k) * Math.round(dt));
    // observed game values
    // Antiquity
    //  1     200
    // Exploration
    //  1     799
    // Modern
    //  1    1331
    //  2    3658
    //  3    7450
    //  4   12604
    //  5   19021
    //  6   26597
    //  7   35233
    //  8   43869
    //  9   52505
    // 10   61141
}
export function getGoldenAgeInfo(player) {
    const rplayers = ReflectionArchives.getPlayers().getChildren();
    const rplayer = rplayers?.find(item => item.id.owner == player.id)?.getChildren();
    const happiness = rplayer?.find(item => item.typeStr == "PlayerHappiness");
    let info = {};
    for (let i = 0; i < (happiness?.memberCount ?? 0); ++i) {
        const field = happiness.getMember(i).name;
        const value = happiness.getMemberValueString(i);
        info[field] = value;
        if (!field.startsWith('m_')) continue;
        const prop = field.substring(3);
        switch (field[2]) {
            case 'b':
                info[prop] = value === 'true';
                break;
            case 'e':
            case 'i':
                info[prop] = parseInt(value);
                break;
            default:
                continue;
        }
    }
    // get the current celebration type
    if (player.Happiness.isInGoldenAge()) {
        const gtype = player.Happiness.getCurrentGoldenAge();
        info.current = GameInfo.GoldenAges.lookup(gtype) ?? null;
    }
    // calculate celebration thresholds (next and last)
    // the next threshold is usually in player.Happiness, but the value
    // doesn't update to the next level until after the player chooses
    // a celebration bonus.  determine whether the current value is next
    // or last and then calculate the other one.
    const pending = info.current === null;  // choice pending
    const earned = (info.NumGoldenAgesEarned ?? 0) + (pending ? 1 : 0);
    const next = player.Happiness?.nextGoldenAgeThreshold ?? info.NextGoldenAgeThreshold;
    info.threshold = { pending, earned, };
    if (pending) {
        info.threshold.last = next ?? getGoldenAgeThreshold(earned);
        info.threshold.next = getGoldenAgeThreshold(earned + 1);
    } else {
        info.threshold.last = getGoldenAgeThreshold(earned);
        info.threshold.next = next ?? getGoldenAgeThreshold(earned + 1);
    }
    return info;
}
class bzScreenPolicies {
    constructor(component) {
        this.component = component;
        component.bzComponent = this;
    }
    beforeAttach() { }
    afterAttach() {
        // get the icon for the current celebration, if any
        const ginfo = getGoldenAgeInfo(this.component.localPlayer);
        const gicon = this.component.overviewWindow
            .querySelector(".policies__overview-happiness-meter-image");
        gicon.style.backgroundImage = ginfo.current ?
            UI.getIconCSS(ginfo.current.GoldenAgeType) : 'url("celeb_happiness_icon")';
    }
    beforeDetach() { }
    afterDetach() { }
    onAttributeChanged(_name, _prev, _next) { }
}
Controls.decorate('screen-policies', (component) => new bzScreenPolicies(component));
