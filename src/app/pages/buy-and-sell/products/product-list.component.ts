import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { Product } from '../../../models/Product';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  selectedCategory: string;
  type: string;
  pageLoading = false;

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.selectedCategory = params['category'] || 'All';
      console.log('Selected Category:', this.selectedCategory);
      this.getProducts();
    });
  }

  getProductImage(product: Product): string {
    if (product.photos && product.photos.length > 0) {
      console.log("imageeeeerrrrrrrrrrrrrrrrreeeeee",product.photos[0].url);
      return product.photos[0].url; // Return the URL of the first photo
    } else {
      return 'assets/imgs/no-image.png'; // Placeholder image if no photos exist
    }
  }

  getProducts() {
    this.pageLoading = true;
    const query = '';  // No search query by default

    this.productService.available(0, query, this.selectedCategory).then(
      resp => {
        console.log('Filtered products response:', resp);
        this.products = resp.data.products.map(prd => new Product(prd));
        this.pageLoading = false;
      },
      err => {
        console.error('API Error:', err);
        this.pageLoading = false;
      }
    );
  }
}
