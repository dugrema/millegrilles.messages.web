import React from 'react';
import moment from 'moment-timezone';

class DateFormatter {

  date_default = 'YYYY/MM/DD';
  datetime_default = 'YYYY/MM/DD HH:mm:ss';
  datemonthhour_default  = 'MMM-DD HH:mm:ss';

  timezone_default = 'America/Toronto';

  format_date(date) {
    // On assume que la date est en secondes (epoch).
    return moment(date*1000).tz(this.timezone_default).format(this.date_default);
  }

  format_datetime(date) {
    // On assume que la date est en secondes (epoch).
    return moment(date*1000).tz(this.timezone_default).format(this.datetime_default);
  }

  format_monthhour(date) {
    // On assume que la date est en secondes (epoch).
    return moment(date*1000).tz(this.timezone_default).format(this.datemonthhour_default);
  }

}

// class NumberFormatter {
//   format_numberdecimals(number, decimals) {
//     if(number) {
//       return number.toFixed(decimals);
//     }
//     return;
//   }
// }

// class FileSizeFormatter {
//
//   constructor() {
//     this.kb = 1024;
//     this.mb = this.kb*1024;
//     this.gb = this.mb*1024;
//     this.tb = this.gb*1024;
//     this.precision = 3;
//   }
//
//   format(nbBytes) {
//     let result, unite;
//     if(nbBytes > this.tb) {
//       result = (nbBytes/this.tb).toPrecision(this.precision);
//       unite = 'Tb';
//     } else if(nbBytes > this.gb) {
//       result = (nbBytes/this.gb).toPrecision(this.precision);
//       unite = 'Gb';
//     } else if(nbBytes > this.mb) {
//       result = (nbBytes/this.mb).toPrecision(this.precision);
//       unite = 'Mb';
//     } else if(nbBytes > this.kb) {
//       result = (nbBytes/this.kb).toPrecision(this.precision);
//       unite = 'kb';
//     } else {
//       result = nbBytes;
//       unite = 'bytes';
//     }
//
//     return result + ' ' + unite;
//   }
// }

export class DateTimeFormatter extends React.Component {

  renderDernierChangement() {
    let date = this.props.date;

    if(!date || date === '') {
      // Date vide
      return (<span title=""></span>);
    }

    const dateformatter = new DateFormatter()

    var maintenant = Math.floor(Date.now()/1000);
    let dateChangement = dateformatter.format_datetime(date);
    let dernierChangementDepuis = maintenant - date;
    dernierChangementDepuis = Math.floor(dernierChangementDepuis / 60);

    let dernierChangementRendered;
    var s;  // Ajouter s (pluriels) au besoin
    if(dernierChangementDepuis < 60) {
      dernierChangementDepuis = Math.max(0, dernierChangementDepuis);
      dernierChangementRendered = (<span title={dateChangement}>{dernierChangementDepuis} minutes</span>);
    } else if (dernierChangementDepuis < 1440) {
      dernierChangementDepuis = Math.floor(dernierChangementDepuis / 60);
      if(dernierChangementDepuis > 1) s = 's';
      dernierChangementRendered = (<span title={dateChangement}>{dernierChangementDepuis} heure{s}</span>);
    } else if (dernierChangementDepuis < 43200) {
      dernierChangementDepuis = Math.floor(dernierChangementDepuis / 1440);
      if(dernierChangementDepuis > 1) s = 's';
      dernierChangementRendered = (<span title={dateChangement}>{dernierChangementDepuis} jour{s}</span>);
    } else if (dernierChangementDepuis < 525600) {
      dernierChangementDepuis = Math.floor(dernierChangementDepuis / 43200);
      dernierChangementRendered = (<span title={dateChangement}>{dernierChangementDepuis} mois</span>);
    } else {
      dernierChangementDepuis = Math.floor(dernierChangementDepuis / 525600);
      if(dernierChangementDepuis > 1) s = 's';
      dernierChangementRendered = (<span title={dateChangement}>{dernierChangementDepuis} annee{s}</span>);
    }

    return dernierChangementRendered;
  }

  render() {
    return (
      <span className="date">
        {this.renderDernierChangement()}
      </span>
    );
  }

}

export class DateTimeAfficher extends React.Component {

  render() {
    let date = this.props.date;

    if(!date || date === '') {
      // Date vide
      return (<span title=""></span>);
    }

    const dateformatter = new DateFormatter()
    let dateFormattee = dateformatter.format_datetime(date);
    return (
      <span className="date">
        {dateFormattee}
      </span>
    );
  }

}
