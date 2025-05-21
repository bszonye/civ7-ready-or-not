// TODO: normalize dimensions to 1/18rem
const BZ_HEAD_STYLE = [
`
.policies__overview-happiness-meter-circle  {
    position: relative;
    top: 0.0277777778rem;  /* TODO: half pixel */
    left: -0.0833333333rem;  /* TODO: half pixel */
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

export function getCurrentGoldenAge(playerID) {
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
class bzScreenPolicies {
    constructor(component) {
        this.component = component;
        component.bzComponent = this;
        this.Root = this.component.Root;
        this.localPlayer = null;
        this.overviewWindow = null;
    }
    beforeAttach() { }
    afterAttach() {
        this.localPlayer = this.component.localPlayer;
        this.overviewWindow = this.component.overviewWindow;
        // get the icon for the current celebration, if any
        const gtype = this.localPlayer.Happiness?.isInGoldenAge() ?
            getCurrentGoldenAge(this.localPlayer.id)?.GoldenAgeType ?? null :
            null;
        const icon = this.overviewWindow.querySelector(".policies__overview-happiness-meter-image");
        icon.style.backgroundImage = gtype ?
            UI.getIconCSS(gtype) :
            'url("celeb_happiness_icon")';
    }
    beforeDetach() { }
    afterDetach() { }
    onAttributeChanged(_name, _prev, _next) { }
}
Controls.decorate('screen-policies', (component) => new bzScreenPolicies(component));
