import React from "preact/compat";
import cx from "classnames";
import { _ } from "../../js/i18n.js";
import {
  TRUSTED_IMAGE_DOMAINS,
  normalizeDomain,
  parseTrustedDomains,
} from "./image_preview_util.js";

const h = React.createElement;

const TrashIcon = () =>
  h(
    "svg",
    {
      width: "12",
      height: "12",
      viewBox: "0 0 16 16",
      fill: "currentColor",
      "aria-hidden": "true",
      style: { display: "block" },
    },
    h("path", {
      d: "M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z",
    }),
    h("path", {
      fillRule: "evenodd",
      d: "M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z",
    })
  );

export class TrustedDomainManager extends React.Component {
  state = {
    customInput: "",
  };

  getDomainList() {
    return parseTrustedDomains(this.props.value);
  }

  updateDomainList(newList) {
    if (this.props.onChange) {
      this.props.onChange(newList);
    }
  }

  handleAdd = () => {
    const raw = (this.state.customInput || "").trim();
    if (!raw) return;
    const parts = raw.split(/[\s,]+/);
    const current = this.getDomainList();
    const next = [...current];
    for (const part of parts) {
      const domain = normalizeDomain(part);
      if (
        domain &&
        !next.some((d) => d.toLowerCase() === domain.toLowerCase())
      ) {
        next.push(domain);
      }
    }
    if (next.length !== current.length) {
      this.updateDomainList(next);
    }
    this.setState({ customInput: "" });
  };

  handleRemove = (index) => {
    const current = this.getDomainList();
    current.splice(index, 1);
    this.updateDomainList(current);
  };

  handleRestoreDefault = () => {
    this.updateDomainList([...TRUSTED_IMAGE_DOMAINS]);
  };

  handleInputChange = (e) => {
    this.setState({ customInput: e.target.value });
  };

  handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.handleAdd();
    }
  };

  render() {
    const { disabled } = this.props;
    const { customInput } = this.state;
    const domainList = this.getDomainList();

    return h(
      "div",
      {
        className: cx(
          "FontManager",
          "FontManager--compact",
          "TrustedDomainManager"
        ),
        style: disabled ? { opacity: 0.65 } : undefined,
      },
      h(
        "div",
        { className: "FontManager__Toolbar" },
        h(
          "span",
          { className: "FontManager__Toolbar__Title" },
          _("options_trustedDomains_title")
        ),
        h(
          "div",
          { className: "FontManager__Toolbar__Actions" },
          h(
            "button",
            {
              type: "button",
              className: "btn btn-default btn-xs",
              onClick: this.handleRestoreDefault,
              title: _("options_fontList_restoreDefault"),
            },
            _("options_fontList_restoreDefault")
          )
        )
      ),
      h(
        "div",
        { className: "FontManager__List" },
        domainList.length === 0
          ? h(
              "div",
              { className: "FontManager__Empty" },
              _("options_trustedDomains_empty")
            )
          : domainList.map((domain, idx) =>
              h(
                "div",
                {
                  key: `${domain}-${idx}`,
                  className: "FontManager__Item",
                },
                h(
                  "div",
                  { className: "FontManager__Item__Info" },
                  h("span", { className: "FontManager__Item__Name" }, domain)
                ),
                h(
                  "div",
                  { className: "FontManager__Item__Controls" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn btn-danger btn-xs",
                      onClick: () => this.handleRemove(idx),
                      title: _("options_fontList_remove"),
                    },
                    h(TrashIcon)
                  )
                )
              )
            )
      ),
      h(
        "div",
        { className: "FontManager__AddBox" },
        h("input", {
          type: "text",
          className: "form-control FontManager__AddBox__Input",
          value: customInput,
          onChange: this.handleInputChange,
          onKeyDown: this.handleInputKeyDown,
          placeholder: _("options_trustedDomains_placeholder"),
        }),
        h(
          "button",
          {
            type: "button",
            className: "btn btn-primary btn-sm FontManager__AddBox__Button",
            disabled: !normalizeDomain(customInput),
            onClick: this.handleAdd,
          },
          _("options_fontList_add")
        )
      )
    );
  }
}

export default TrustedDomainManager;
