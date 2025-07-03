import { Component } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-terms-modal',
  templateUrl: './terms-modal.component.html',
  styleUrls: ['./terms-modal.component.scss'],
})
export class TermsModalComponent {

  constructor(private modalController: ModalController) {}

  dismiss(accepted: boolean = false) {
    this.modalController.dismiss({ accepted });
  }
}
