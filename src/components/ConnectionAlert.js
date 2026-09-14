import React, { useEffect } from "react";
import { _ } from "../js/i18n";
import "./PageTopAlert.css";

export const handleConnectionAlertKeyDown = (e, onDismiss) => {
  const target = e.target;
  const isTermInput =
    target &&
    (target.id === "t" ||
      (typeof window !== "undefined" && target === window.app?.inputArea));
  const isEditable =
    target &&
    !isTermInput &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable);
  const isInModal =
    (typeof document !== "undefined" &&
      document.body?.classList?.contains("modal-open")) ||
    (typeof window !== "undefined" && Boolean(window.app?.modalShown)) ||
    (target &&
      typeof target.closest === "function" &&
      (target.closest(".modal") || target.closest("dialog[open]")));

  if (isEditable || isInModal) {
    return;
  }

  if (e.key === "Enter" || e.code === "Enter" || e.keyCode === 13) {
    onDismiss();
  }
  // Kills everything because we don't want any further action performed under ConnectionAlert status
  e.preventDefault();
  e.stopImmediatePropagation();
};

export const ConnectionAlert = ({ onDismiss }) => {
  useEffect(() => {
    const handler = (e) => handleConnectionAlertKeyDown(e, onDismiss);

    window.addEventListener("keydown", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
    };
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="alert alert-danger alert-dismissible PageTopAlert fade in"
    >
      <button
        type="button"
        className="close"
        aria-label="Close"
        onClick={onDismiss}
      >
        <span aria-hidden="true">&times;</span>
      </button>
      <h4>{_("alert_connectionHeader")}</h4>
      <p>{_("alert_connectionText")}</p>
      <p>
        <button type="button" className="btn btn-danger" onClick={onDismiss}>
          {_("alert_connectionReconnect")}
        </button>
      </p>
    </div>
  );
};

export default ConnectionAlert;
