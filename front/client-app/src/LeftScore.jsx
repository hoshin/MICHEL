import "./ScoreScene.css";
import "./LeftScore.css";

function LeftScore({ teamName, teamLogo, teamScore }) {
  let fontClass = "regular-font";
  if (teamName.length > 19) {
    fontClass = "small-font";
  }
  if (teamName.length > 25) {
    fontClass = "smallest-font";
  }

  return (
    <div className="left-cast-bar">
      <p className={`cast-team-name ${fontClass}`}>{teamName}</p>
      <img src={teamLogo} className="cast-team-logo left-cast-logo" />
      <div className="cast-team-score left-cast-score">{teamScore}</div>
    </div>
  );
}

export default LeftScore;
