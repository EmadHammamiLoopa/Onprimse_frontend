import { Location } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChange, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnChanges {

  @Input() back = false;
  @Input() menu = false;
  @Input() title = "";
  @Input() backLink = undefined;
  @Input() search = false;
  @Input() modal = false;
  @Input() reverseColors = false;
  backgroundColor = "white";
  textColor = "#7C3CD7";
  @Input() avatar = false;
  @Input() avatarSrc: string;
  @Input() avatarLink: string;

  @Output() searchKeyUp = new EventEmitter();
  @Output() titleClicked = new EventEmitter();

  constructor(private location: Location, private router: Router, private modalCtrl: ModalController) { }

  ngOnInit() {}

  ngOnChanges(changes: SimpleChanges){
    if(changes.reverseColors){
      const color = this.backgroundColor;
      this.backgroundColor = this.textColor;
      this.textColor = color
    }
  }

  goBack(){
    if(this.modal) this.modalCtrl.dismiss({});
    else if(this.backLink) this.router.navigateByUrl(this.backLink);
    else this.location.back();
  }

  doSearch(event){
    const value = event.target.value;
    this.searchKeyUp.emit(value)
  }

}
