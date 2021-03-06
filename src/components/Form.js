import React, { Component } from "react";
import PropTypes from "prop-types";
import MediaPlayer from "./MediaPlayer";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Select from "react-dropdown-select";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import Nav from "./Nav";
import { Editor } from "@tinymce/tinymce-react";
import history from "../history";

export default class Form extends Component {
  constructor() {
    super();
    this.state = {
      link: {
        keywords: [{ id: 12, label: "Perspective", value: "Perspective" }],
        title: "Carl Sagan - Pale Blue Dot",
        url: "https://www.youtube.com/watch?v=wupToqz1e2g",
        takeaways: "Look again at that dot. That's here. That's home. That's us. <div>On it everyone you love, <br>everyone you know, <br>everyone you ever heard of, <br>every human being who ever was, lived out their lives.</div>",
        lastAccessed: "3 months ago",
        id: 0,
        hasLink: true,
      },
      keywordOptions: [],
    };
  }

  componentDidMount() {
    this.getKeywords();
    this.pingServer();
    if (this.props.id !== "0") {
      this.refresh(this.props.id);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.id !== prevProps.id) {
      this.refresh(this.props.id);
    }
  }

  getKeywords = async () => {
    const res = await fetch(process.env.REACT_APP_BACKEND_URL + "keywords");
    const json = await res.json();
    let i = 0;
    const formattedKeywords = json.map((word) => {
      return { id: i++, label: word, value: word };
    });
    this.setState({ keywordOptions: formattedKeywords });
  };

  /**
   * Ping the server on load so that the heroku db can startup asap
   */
  pingServer = () => {
    return fetch(process.env.REACT_APP_BACKEND_URL + "ping");
  };

  formatLink = (link) => {
    if (!link.keywords) {
      link.keywords = [];
    } else {
      link.keywords = link.keywords.split(",");
    }
    let i = 0;
    link.keywords = link.keywords.map((word) => {
      return { id: i++, label: word, value: word };
    });
    link.lastAccessed = this.getTimeDiff(link.last_accessed);
    return link;
  };

  getTimeDiff = (lastAccessed) => {
    const now = new Date().getTime();
    const before = new Date(lastAccessed).getTime();
    if (Number.isNaN(before) || before === 0) {
      return "Never accessed before";
    }
    return this.formatTimeInterval(now - before);
  };

  /**
   * @param interval time interval in ms
   */
  formatTimeInterval = (interval) => {
    const days = Math.floor(interval / (1000 * 60 * 60 * 24));
    if (days > 365) {
      return `${Math.floor(days / 365)} year(s) ago`;
    } else if (days === 0) {
      return `today`;
    } else if (days === 1) {
      return `${days} day ago`;
    }
    return `${days} days ago`;
  };

  minifyLink = (link) => {
    if (!link.keywords) {
      console.error(link);
    }
    const keywordArray = [];
    link.keywords.forEach((obj) => {
      keywordArray.push(obj.value);
    });
    link.keywords = keywordArray.join(",");
    return link;
  };

  getRandomLink = async () => {
    const res = await fetch(process.env.REACT_APP_BACKEND_URL + "random-link");
    const link = await res.json();
    history.push(`/link/${link.id}`);
    return this.formatLink(link);
  };

  getLink = async (id) => {
    const res = await fetch(process.env.REACT_APP_BACKEND_URL + `link/${id}`);
    if (res.status !== 404) {
      const link = await res.json();
      return this.formatLink(link);
    }
  };

  /**
   * @param {Event (which is ignored) or an integer} id
   */
  refresh = async (id) => {
    let link;
    if (!Number.isNaN(parseInt(id))) {
      link = await this.getLink(parseInt(id));
    }
    if (!link) {
      link = await this.getRandomLink();
    }
    this.setState({ link: link, hasLink: true });
  };

  changeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;

    const newLink = this.state.link;
    newLink[name] = value;
    this.setState({
      link: newLink,
    });
  };
  handleEditorChange = (content, editor) => {
    const newLink = this.state.link;
    newLink["takeaways"] = content;
    this.setState({
      link: newLink,
    });
  };

  updateLink = async (event) => {
    event.preventDefault();
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.minifyLink({ ...this.state.link })),
    };

    const api = this.state.hasLink ? "update-link" : "add-link";
    const response = await fetch(
      `${process.env.REACT_APP_BACKEND_URL}${api}`,
      requestOptions
    );
    if (response.status === 400) {
      const a = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}search?url=${this.state.link.url}`
      );
      const b = await a.json();
      if (!b[0]) {
        return console.error(b);
      }
      return toast("Duplicate url: the original has id: " + b[0].id);
    }
    const data = await response.json();
    let message = `${this.state.hasLink ? "Updated" : "Added"} link: ${this.state.link.title
      }`;
    if (!this.state.hasLink) {
      message += ` with id: ${data.id}`;
    }
    toast(message);
    history.push(`/link/${data.id}`);
    this.setState({ hasLink: true });
  };

  confirmDelete = () => {
    confirmAlert({
      title: `Delete "${this.state.link.title}"?`,
      message: "",
      buttons: [
        {
          label: "Yes",
          onClick: () => {
            this.deleteLink();
          },
        },
        {
          label: "No",
          onClick: () => {
            return;
          },
        },
      ],
    });
  };
  deleteLink = async () => {
    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: this.state.link.id,
      }),
    };

    fetch(process.env.REACT_APP_BACKEND_URL + "delete-link", requestOptions)
      .then((response) => response.json())
      .then((data) => {
        toast(`Deleted link: ${this.state.link.title}`);
      })
      .catch((error) => {
        console.error(error);
        toast("Couldn't delete the link");
      });
  };

  clearForm = () => {
    history.push(`/`);
    this.setState({
      link: {
        takeaways: "",
        title: "",
        url: "",
        keywords: [],
        lastAccessed: "",
      },
      hasLink: false,
    });
  };

  /**
   * Update the keywords of the link
   */
  keywordSelected = (selected) => {
    selected = selected.sort((a, b) => {
      return a.label > b.label ? -1 : 1;
    });
    const link = { ...this.state.link };
    link.keywords = selected.map((keyword) => {
      if (keyword && typeof keyword === "object") {
        return {
          ...keyword,
          label: this.capitalizeFirstLetter(keyword.label),
          value: this.capitalizeFirstLetter(keyword.value),
        };
      } else {
        return {
          id: keyword,
          value: keyword,
          label: keyword,
        };
      }
    });
    this.setState({ link });
  };
  capitalizeFirstLetter = (str) => {
    return str[0].toUpperCase() + str.slice(1);
  };

  render() {
    return (
      <div className="app container">
        <div className="form-container">
          <Nav
            refresh={this.refresh}
            confirmDelete={this.confirmDelete}
            clearForm={this.clearForm}
          />
          <MediaPlayer
            className="mediaPlayer"
            url={this.state.link.url || ""}
            onEnded={this.updateLink}
          ></MediaPlayer>
          <form className="form">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              name="title"
              className="input input--text"
              value={this.state.link.title || ""}
              onChange={this.changeHandler}
            />
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="url"
              name="url"
              className="input input--text"
              value={this.state.link.url || ""}
              onChange={this.changeHandler}
            />
            <label htmlFor="keywords">Keywords</label>
            <div id="keywords" className="keywords">
              <Select
                values={this.state.link.keywords}
                multi={true}
                options={this.state.keywordOptions || []}
                onChange={this.keywordSelected}
                create={true}
              />
            </div>
            <label htmlFor="lastAccessed">Last accessed</label>
            <p id="lastAccessed">{this.state.link.lastAccessed}</p>
            <label htmlFor="takeaways" style={{ color: "white" }}>
              Takeaways
            </label>
            <div className="text-editor">
              <Editor
                apiKey="mhoop81tplrihnhuphy89bsw7qjq01dhzkjdzgb61ruf4itq"
                init={{
                  height: 400,
                  menubar: false,
                  plugins: [
                    "advlist autolink lists link image charmap print preview anchor",
                    "searchreplace visualblocks code fullscreen",
                    "insertdatetime media table paste code help wordcount",
                  ],
                  toolbar:
                    `undo redo | formatselect | bold italic backcolor |` +
                    `alignleft aligncenter alignright alignjustify |` +
                    `bullist numlist outdent indent | removeformat | help | image insertdatetime`,
                }}
                textAreaName="takeaways"
                value={this.state.link.takeaways || ""}
                onEditorChange={this.handleEditorChange}
              />
            </div>
            <button
              id="submitButton"
              type="submit"
              name="submitButton"
              className="submit-button"
              onClick={this.updateLink}
            >
              {this.state.hasLink ? "Update" : "Add"}
            </button>
          </form>
          <ToastContainer />
        </div>
      </div>
    );
  }
}

Form.propTypes = {
  client: PropTypes.object,
};
