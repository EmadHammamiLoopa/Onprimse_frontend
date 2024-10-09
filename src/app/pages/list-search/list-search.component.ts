import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-list-search',
  templateUrl: './list-search.component.html',
  styleUrls: ['./list-search.component.scss'],
})
export class ListSearchComponent implements OnInit {
  @Input() data: any[];
  @Input() title: string;
  @Input() multiSelect: boolean = false;

  searchTerm: string = '';
  paginatedData: any[] = [];
  pageSize: number = 20;
  currentPage: number = 0;
  selectedItems: any[] = [];

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    console.log('ListSearchComponent initialized with data:', this.data);
    this.paginatedData = this.data.slice(0, this.pageSize);
  }

  dismiss() {
    this.modalCtrl.dismiss(this.selectedItems);
  }

  selectData(item) {
    if (this.multiSelect) {
      if (this.selectedItems.includes(item)) {
        this.selectedItems = this.selectedItems.filter(i => i !== item);
      } else {
        this.selectedItems.push(item);
      }
      this.modalCtrl.dismiss(this.selectedItems);  // Dismiss the modal with the selected items
    } else {
      this.modalCtrl.dismiss(item);
    }
  }

  search(event: Event) {
    const searchTerm = (event.target as HTMLInputElement).value;
    this.searchTerm = searchTerm;
    this.currentPage = 0;
  
    if (searchTerm && searchTerm.trim() !== '') {
      this.paginatedData = this.data
        .filter(item => item.name ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) : item.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, this.pageSize);
    } else {
      this.paginatedData = this.data.slice(0, this.pageSize);
    }
  }
  

  loadMore(event) {
    setTimeout(() => {
      this.currentPage++;
      const newItems = this.data.slice(this.currentPage * this.pageSize, (this.currentPage + 1) * this.pageSize);
      this.paginatedData = this.paginatedData.concat(newItems);
      event.target.complete();

      // If no more new items, disable the infinite scroll
      if (newItems.length < this.pageSize) {
        event.target.disabled = true;
      }
    }, 500);
  }
}
